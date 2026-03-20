import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server,
  Zap,
  LayoutGrid,
  List,
  Activity,
  Loader2,
  Trash2,
  X,
  Power,
  PowerOff
} from 'lucide-react';
import api from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const profilesRef = useRef<VPSProfile[]>([]);

  useEffect(() => {
    fetchProfiles();
    const specInterval = setInterval(() => {
      profilesRef.current.filter(p => p.isConnected).forEach(p => fetchSpecs(p.id));
    }, 30_000);
    return () => clearInterval(specInterval);
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data } = await api.get('/vps');
      setProfiles(data.profiles);
      profilesRef.current = data.profiles;
      data.profiles.forEach((p: VPSProfile) => {
        if (p.isConnected) fetchSpecs(p.id);
      });
    } catch (err) {
      setError('Failed to load infrastructure nodes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecs = async (id: string) => {
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
      } catch (usageErr) {
        // Fallback if usage fails but specs worked
        setSpecs(prev => ({ ...prev, [id]: { ...specsData, cpuLoad: 0 } }));
      }
    } catch (err) {
      console.error('Failed to fetch node specs', err);
    }
  };

  const handleConnect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnecting(id);
    try {
      await api.post(`/vps/${id}/connect`);
      showToast('Server connected successfully', 'success');
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/vps/${id}/disconnect`);
      showToast('Server disconnected', 'info');
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Disconnection failed');
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
    } catch (err) {
      setError('Decommission failed');
    } finally {
      setConfirmDelete(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-[#f8fafc] items-center justify-center space-y-4">
       <Loader2 size={40} className="text-blue-600 animate-spin" />
       <span className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">Retrieving Clusters...</span>
    </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-500">
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
        {[
          { label: 'Total Servers', value: profiles.length, sub: 'ALL REGIONS', icon: <Server size={20} />, color: 'blue' },
          { label: 'Online Nodes', value: profiles.filter(p => p.isConnected).length, sub: 'ACTIVE', icon: <Zap size={20} />, color: 'emerald' },
          { label: 'Offline Nodes', value: profiles.filter(p => !p.isConnected).length, sub: 'CRITICAL', icon: <X size={20} />, color: 'red' }
        ].map((metric) => (
          <div key={metric.label} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm premium-card hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl text-white ${
                metric.color === 'blue' ? 'icon-grad-blue shadow-[0_4px_12px_rgba(59,130,246,0.3)]' : 
                metric.color === 'emerald' ? 'icon-grad-emerald shadow-[0_4px_12px_rgba(16,185,129,0.3)]' : 
                'icon-grad-rose shadow-[0_4px_12px_rgba(244,63,94,0.3)]'
              }`}>
                {metric.icon}
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">{metric.sub}</span>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900 tracking-tighter mb-0.5">{metric.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{metric.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Active Instances Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Instances</h2>
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

        {viewMode === 'list' ? (
          <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instance Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Region</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">IP Address</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">CPU Load</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {profiles.map((vps) => (
                  <tr 
                    key={vps.id} 
                    onClick={() => navigate(`/vps/${vps.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2.5 rounded-xl ${vps.isConnected ? 'icon-grad-blue text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                          <Server size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{vps.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {vps.isConnected ? (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-red-50 text-red-500 border border-red-100 rounded-full w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500 tracking-tight">
                      {vps.region || (vps.isConnected ? (specs[vps.id]?.region || 'DETECTING...') : '—')}
                    </td>
                    <td className="px-6 py-5 text-sm font-mono text-slate-400">{vps.host}</td>
                    <td className="px-6 py-5 text-right w-48">
                      <div className="flex items-center justify-end space-x-3">
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${vps.isConnected ? 'bg-blue-600' : 'bg-slate-300'}`}
                            style={{ width: `${vps.isConnected ? (specs[vps.id]?.cpuLoad || 0) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8">{vps.isConnected ? `${specs[vps.id]?.cpuLoad || 0}%` : '0%'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {!vps.isConnected ? (
                        <button 
                          onClick={(e) => handleConnect(vps.id, e)}
                          disabled={connecting === vps.id}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all shadow-md shadow-blue-600/10 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                        >
                          {connecting === vps.id ? <Loader2 size={12} className="animate-spin" /> : "Connect"}
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => handleDisconnect(vps.id, e)}
                          className="px-4 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-500 text-[10px] font-black rounded-lg transition-all active:scale-95 uppercase tracking-widest"
                        >
                          Disconnect
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {profiles.length === 0 && (
              <div className="py-20 text-center">
                <Server size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No instances detected</p>
              </div>
            )}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing {profiles.length} of {profiles.length} Instances</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((vps) => (
                <div 
                  key={vps.id}
                  onClick={() => navigate(`/vps/${vps.id}`)}
                  className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm premium-card hover:shadow-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-4 rounded-2xl ${vps.isConnected ? 'icon-grad-blue text-white shadow-lg shadow-blue-500/30' : 'bg-slate-50 text-slate-400'}`}>
                      <Server size={24} />
                    </div>
                    <button 
                      onClick={(e) => handleDelete(vps.id, vps.name, e)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{vps.name}</h3>
                    <p className="text-xs font-mono text-slate-400 mb-4">{vps.username}@{vps.host}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${vps.isConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${vps.isConnected ? 'bg-emerald-500 animate-pulse-soft' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{vps.isConnected ? 'Live' : 'Offline'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                         {vps.isConnected && (
                           <div className="flex items-center space-x-1.5 mr-2">
                             <Activity size={14} className="text-blue-600" />
                             <span className="text-xs font-bold text-slate-900">{specs[vps.id]?.cpuLoad || 0}%</span>
                           </div>
                         )}
                         {!vps.isConnected ? (
                            <button 
                              onClick={(e) => handleConnect(vps.id, e)}
                              disabled={connecting === vps.id}
                              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                            >
                               {connecting === vps.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                            </button>
                         ) : (
                            <button 
                              onClick={(e) => handleDisconnect(vps.id, e)}
                              className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                            >
                               <PowerOff size={16} />
                            </button>
                         )}
                      </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
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
