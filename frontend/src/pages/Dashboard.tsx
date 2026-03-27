import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server,
  Zap,
  LayoutGrid,
  List,
  X,
  Search,
  RefreshCw,
  Power
} from 'lucide-react';
import api from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import MetricCard from '../components/Dashboard/MetricCard';
import VpsListView from '../components/Dashboard/VpsListView';
import VpsGridView from '../components/Dashboard/VpsGridView';
import Skeleton from '../components/Skeleton';

interface VPSProfile {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  authType: string;
  isConnected: boolean;
  region?: string;
}

interface ServerSpecs {
  os: string;
  cpu: string;
  ram: string;
  disk: string;
  cpuLoad?: number;
  region?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<VPSProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, ServerSpecs>>({});
  const [fetchingSpecs, setFetchingSpecs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('dashboardViewMode') as 'grid' | 'list') || 'list';
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  
  // New Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');
  const [refreshing, setRefreshing] = useState(false);
  const [connectingAll, setConnectingAll] = useState(false);

  const profilesRef = useRef<VPSProfile[]>([]);

  useEffect(() => {
    fetchProfiles();
    const specInterval = setInterval(() => {
      profilesRef.current.filter(p => p.isConnected).forEach(p => fetchSpecs(p.id));
    }, 30_000);
    return () => clearInterval(specInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync with state so the interval always sees the latest profiles
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('dashboardViewMode', viewMode);
  }, [viewMode]);

  const fetchProfiles = async () => {
    try {
      const { data } = await api.get('/vps');
      setProfiles(data.profiles);
      profilesRef.current = data.profiles;
      data.profiles.forEach((p: VPSProfile) => {
        if (p.isConnected) fetchSpecs(p.id);
      });
    } catch {
      setError('Failed to load infrastructure nodes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchProfiles();
  };

  const fetchSpecs = async (id: string) => {
    setFetchingSpecs(prev => new Set(prev).add(id));
    try {
      // Get static hardware specs
      const { data: specsData } = await api.get(`/vps/${id}/specs`);
      
      // Get real-time usage (CPU/RAM %)
      try {
        const { data: usageData } = await api.get(`/vps/${id}/usage`);
        setSpecs(prev => ({ 
          ...prev, 
          [id]: { ...specsData, cpuLoad: usageData.cpu } 
        }));
      } catch {
        // Fallback if usage fails but specs worked
        setSpecs(prev => ({ ...prev, [id]: { ...specsData, cpuLoad: 0 } }));
      }
    } catch (err: unknown) {
      console.error('Failed to fetch node specs', err);
    } finally {
      setFetchingSpecs(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConnect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnecting(id);
    // Optimistic UI: Set isConnected to true in the local profiles state
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, isConnected: true } : p));
    
    try {
      await api.post(`/vps/${id}/connect`);
      showToast('Server connected successfully', 'success');
      // No need to fetchProfiles() immediately if we trust the change, 
      // but we do it to ensure DB consistency
      await fetchProfiles();
    } catch (err: unknown) {
      // Rollback on error
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, isConnected: false } : p));
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic UI: Set isConnected to false locally
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, isConnected: false } : p));
    
    try {
      await api.post(`/vps/${id}/disconnect`);
      showToast('Server disconnected', 'info');
      await fetchProfiles();
    } catch (err: unknown) {
      // Rollback on error
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, isConnected: true } : p));
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Disconnection failed');
    }
  };

  const handleConnectAll = async () => {
    const offlineProfiles = filteredProfiles.filter(p => !p.isConnected);
    if (offlineProfiles.length === 0) return;

    setConnectingAll(true);
    
    // Optimistic UI
    setProfiles(prev => prev.map(p => 
      offlineProfiles.some(op => op.id === p.id) ? { ...p, isConnected: true } : p
    ));

    try {
      await Promise.allSettled(
        offlineProfiles.map(p => api.post(`/vps/${p.id}/connect`))
      );
      showToast(`Attempted to connect ${offlineProfiles.length} servers`, 'info');
      await fetchProfiles();
    } catch (err) {
      console.error(err);
      setError('Bulk connection encountered errors');
      await fetchProfiles(); // Revert optimistic UI on error
    } finally {
      setConnectingAll(false);
    }
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ id, name });
  };

  const confirmDeleteServer = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/vps/${confirmDelete.id}`);
      showToast(`"${confirmDelete.name}" removed`, 'success');
      fetchProfiles();
    } catch {
      setError('Decommission failed');
    } finally {
      setConfirmDelete(null);
    }
  };

  // Derived State: Filter and Sort
  const filteredProfiles = profiles
    .filter(p => {
      // Search
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.host.toLowerCase().includes(searchTerm.toLowerCase());
      // Filter
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'online' && p.isConnected) || 
                            (statusFilter === 'offline' && !p.isConnected);
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        // Sort by status: Online first, then offline
        if (a.isConnected === b.isConnected) {
           return a.name.localeCompare(b.name);
        }
        return a.isConnected ? -1 : 1;
      }
    });

  if (loading) return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="" value="" sub="" icon={null} color="blue" isLoading />
        <MetricCard label="" value="" sub="" icon={null} color="emerald" isLoading />
        <MetricCard label="" value="" sub="" icon={null} color="red" isLoading />
      </section>
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Overview</h1>
        <p className="text-slate-500 text-sm font-medium">Real-time status of your global infrastructure clusters.</p>
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-3 text-sm font-bold">
            <X size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg"><X size={14}/></button>
        </div>
      )}

      {/* Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          label="Total Servers" 
          value={profiles.length} 
          sub="ALL REGIONS" 
          icon={<Server size={20} />} 
          color="blue" 
          onClick={() => setStatusFilter('all')}
          active={statusFilter === 'all'}
        />
        <MetricCard 
          label="Online Nodes" 
          value={profiles.filter(p => p.isConnected).length} 
          sub="ACTIVE" 
          icon={<Zap size={20} />} 
          color="emerald" 
          onClick={() => setStatusFilter('online')}
          active={statusFilter === 'online'}
        />
        <MetricCard 
          label="Offline Nodes" 
          value={profiles.filter(p => !p.isConnected).length} 
          sub="CRITICAL" 
          icon={<X size={20} />} 
          color="red" 
          onClick={() => setStatusFilter('offline')}
          active={statusFilter === 'offline'}
        />
      </section>

      {/* Active Instances Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Instances</h2>
            {statusFilter !== 'all' && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center space-x-1">
                <span>{statusFilter}</span>
                <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-red-500"><X size={12} /></button>
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 outline-none focus:border-blue-500/30 transition-all font-bold placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'status')}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-500/30 shadow-sm appearance-none cursor-pointer"
            >
              <option value="name">Sort by Name</option>
              <option value="status">Sort by Status</option>
            </select>

            {filteredProfiles.some(p => !p.isConnected) && (
              <button 
                onClick={handleConnectAll}
                disabled={connectingAll}
                className="flex items-center space-x-1 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-emerald-500/20 disabled:opacity-50"
              >
                <Power size={14} />
                <span className="hidden sm:inline">{connectingAll ? 'Connecting...' : 'Connect All'}</span>
              </button>
            )}

            <button 
              onClick={handleManualRefresh}
              className="p-2 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-xl shadow-sm transition-all text-xs font-bold"
              title="Refresh servers"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 border-dashed rounded-[32px]">
             <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">No servers found</p>
          </div>
        ) : viewMode === 'list' ? (
          <VpsListView 
            profiles={filteredProfiles}
            specs={specs}
            fetchingSpecs={fetchingSpecs}
            connecting={connecting}
            onNavigate={(id) => navigate(`/vps/${id}`)}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <VpsGridView 
            profiles={filteredProfiles}
            specs={specs}
            fetchingSpecs={fetchingSpecs}
            connecting={connecting}
            onNavigate={(id) => navigate(`/vps/${id}`)}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onDelete={handleDelete}
          />
        )}
      </section>

      {confirmDelete && (
        <ConfirmModal
          title="Decommission Node"
          message={`Permanently remove "${confirmDelete.name}"? This will delete all connection data.`}
          confirmLabel="Decommission"
          danger
          onConfirm={confirmDeleteServer}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

