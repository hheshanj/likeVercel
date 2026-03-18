import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Terminal, 
  Folder, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Cpu, 
  HardDrive, 
  Loader2,
  Trash2,
  Server,
  Zap,
  Power,
  PowerOff,
  Globe,
  PieChart
} from 'lucide-react';
import api from '../utils/api';

interface VPSProfile {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  authType: string;
  isConnected: boolean;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<VPSProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, any>>({});
  const [fetchingSpecs, setFetchingSpecs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data } = await api.get('/vps');
      setProfiles(data.profiles);
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
    setFetchingSpecs(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.get(`/vps/${id}/specs`);
      setSpecs(prev => ({ ...prev, [id]: data }));
    } catch (err) {
      console.error('Failed to fetch node specs', err);
    } finally {
      setFetchingSpecs(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleConnect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnecting(id);
    try {
      await api.post(`/vps/${id}/connect`);
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
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Disconnection failed');
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Permanently decommission node "${name}"?`)) return;
    try {
      await api.delete(`/vps/${id}`);
      fetchProfiles();
    } catch (err) {
      setError('Decommission failed');
    }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-bg-primary items-center justify-center space-y-4">
       <Loader2 size={40} className="text-blue-500 animate-spin" />
       <span className="text-text-secondary font-bold tracking-widest text-xs uppercase">Synchronizing Core</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto custom-scrollbar">
      {/* Refined Header */}
      <header className="sticky top-0 z-30 px-8 py-8 flex items-center justify-between border-b border-black/20 bg-bg-primary/80 backdrop-blur-xl">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-500 mb-1.5">
             <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span>Core Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-text-primary">Overview</h1>
        </div>
        <button 
          onClick={() => navigate('/vps/add')}
          className="flex items-center space-x-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-2xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Connect Node</span>
        </button>
      </header>
      
      <div className="p-8 space-y-10">
        {error && (
          <div className="flex items-center space-x-4 p-5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl animate-in slide-in-from-top-4 duration-300">
             <ShieldAlert size={20} />
             <span className="font-bold text-sm tracking-wide">{error}</span>
          </div>
        )}

        {/* Refined Metrics Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8" data-purpose="metrics-summary">
          {[
            { label: 'Total Infrastructure', value: profiles.length, sub: 'Clusters', icon: <Server size={22} />, color: 'blue' },
            { label: 'Active Connections', value: profiles.filter(p => p.isConnected).length, sub: 'Live Nodes', icon: <Zap size={22} />, color: 'emerald' },
            { label: 'Idle Resources', value: profiles.filter(p => !p.isConnected).length, sub: 'Dormant', icon: <PowerOff size={22} />, color: 'red' }
          ].map((metric, i) => {
            const colorClasses: Record<string, string> = {
              blue: 'bg-blue-500/10 text-blue-500',
              emerald: 'bg-emerald-500/10 text-emerald-500',
              red: 'bg-red-500/10 text-red-500'
            };
            
            return (
              <div key={metric.label} className="glass-effect p-8 rounded-[32px] border border-black/20 relative overflow-hidden group hover:bg-bg-secondary/40 transition-all duration-300 shadow-2xl">
                 <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-text-secondary tracking-widest uppercase">{metric.label}</span>
                    <div className={`p-3 ${colorClasses[metric.color] || 'bg-bg-tertiary text-text-muted'} rounded-xl shadow-inner`}>
                       {metric.icon}
                    </div>
                 </div>
                 <div className="flex items-baseline space-x-3">
                    <span className="text-4xl font-bold text-text-primary tracking-tight">{metric.value}</span>
                    <span className="text-xs font-bold text-text-muted tracking-wide uppercase opacity-60">{metric.sub}</span>
                 </div>
              </div>
            );
          })}
        </section>

        {/* Server Grid Area */}
        <section data-purpose="server-grid">
          <div className="flex items-center justify-between mb-8 px-1">
             <div className="flex items-center space-x-4">
                <div className="h-1.5 w-10 bg-blue-600 rounded-full" />
                <h2 className="text-base font-bold text-text-primary tracking-widest uppercase opacity-80">Compute Core</h2>
             </div>
             <div className="flex space-x-2.5">
                <button className="p-2 bg-bg-secondary border border-border-light text-text-secondary rounded-xl hover:text-text-primary transition-all shadow-md active:scale-95">
                   <PieChart size={18} />
                </button>
                <button className="p-2 bg-bg-secondary border border-border-light text-text-secondary rounded-xl hover:text-text-primary transition-all shadow-md active:scale-95">
                   <Globe size={18} />
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {profiles.length === 0 ? (
              <div className="col-span-full py-24 px-8 glass-effect rounded-[40px] border border-dashed border-border-primary text-center flex flex-col items-center">
                 <div className="p-8 bg-bg-secondary rounded-full mb-8 border border-border-light shadow-inner">
                    <Server size={48} className="text-text-muted/30" />
                 </div>
                 <h3 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">No Registered Endpoints</h3>
                 <p className="text-text-secondary max-w-sm mb-12 text-sm font-medium leading-relaxed">Initialize your first remote deployment node via SSH credentials to begin orchestration.</p>
                 <button 
                    onClick={() => navigate('/vps/add')}
                    className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-2xl transition-all active:scale-95"
                 >
                    Initialize First Node
                 </button>
              </div>
            ) : profiles.map(vps => (
              <article 
                key={vps.id} 
                onClick={() => navigate(`/vps/${vps.id}`)}
                className="group relative glass-effect rounded-[32px] border border-black/20 p-8 transition-all duration-300 hover:bg-bg-secondary/40 cursor-pointer shadow-2xl overflow-hidden"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center space-x-5">
                      <div className={`p-4 rounded-2xl ${vps.isConnected ? 'bg-blue-600 shadow-xl text-white' : 'bg-bg-tertiary text-text-muted'} transition-all`}>
                        <Server size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-text-primary tracking-tight mb-1">{vps.name}</h3>
                        <div className="flex items-center space-x-3">
                           <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-500/10 rounded-lg border border-border-light">
                              <ShieldCheck size={10} className="text-blue-500" />
                              <span className="text-[9px] font-bold text-text-secondary tracking-widest uppercase">{vps.authType === 'privateKey' ? 'Key' : 'Password'}</span>
                           </div>
                           <span className="text-xs font-bold text-text-muted tracking-tight font-mono">{vps.username}@{vps.host}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {vps.isConnected ? (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full">
                           <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-xs font-bold tracking-[0.1em] uppercase">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-bg-tertiary/50 text-text-muted border border-border-light rounded-full">
                           <div className="h-2 w-2 rounded-full bg-text-muted" />
                           <span className="text-xs font-bold tracking-[0.1em] uppercase">Idle</span>
                        </div>
                      )}
                      <button 
                        className="text-text-muted hover:text-red-500 transition-all p-2 hover:bg-red-500/10 rounded-xl" 
                        onClick={(e) => handleDelete(vps.id, vps.name, e)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Refined Specs Section */}
                  <div className="grid grid-cols-4 gap-4 py-6 mb-8 border-y border-black/10 bg-bg-secondary/5 rounded-2xl px-2">
                    {[
                      { label: 'Kernel', value: specs[vps.id]?.os, icon: <Activity className="text-blue-500" size={14} /> },
                      { label: 'Cores', value: specs[vps.id]?.cpu, icon: <Cpu className="text-emerald-500" size={14} /> },
                      { label: 'Mem', value: specs[vps.id]?.ram, icon: <Zap className="text-amber-500" size={14} /> },
                      { label: 'Disk', value: specs[vps.id]?.disk, icon: <HardDrive className="text-purple-500" size={14} /> }
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center space-y-2">
                         <div className="flex items-center space-x-1.5">
                            {item.icon}
                            <span className="text-[10px] font-bold text-text-secondary tracking-widest uppercase opacity-60">{item.label}</span>
                         </div>
                         <div className="h-6 flex items-center justify-center">
                            {vps.isConnected ? (
                               fetchingSpecs[vps.id] ? (
                                 <Loader2 size={14} className="animate-spin text-blue-500/30" />
                               ) : (
                                 <span className="text-xs font-bold text-text-primary tracking-tight font-mono px-1">
                                   {item.value || '...'}
                                 </span>
                               )
                            ) : (
                               <div className="w-6 h-px bg-border-primary rounded-full" />
                            )}
                         </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-4 mt-auto">
                    <div className="flex space-x-2.5 flex-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/vps/${vps.id}?tab=terminal`); }}
                        className="flex-1 flex items-center justify-center space-x-2 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl transition-all active:scale-95 group/btn shadow-sm"
                      >
                        <Terminal size={16} className="group-hover/btn:text-blue-500 transition-colors" />
                        <span className="text-xs font-bold tracking-tight uppercase">Shell</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/vps/${vps.id}?tab=files`); }}
                        className="flex-1 flex items-center justify-center space-x-2 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl transition-all active:scale-95 group/btn shadow-sm"
                      >
                        <Folder size={16} className="group-hover/btn:text-emerald-500 transition-colors" />
                        <span className="text-xs font-bold tracking-tight uppercase">Data</span>
                      </button>
                    </div>

                    {!vps.isConnected ? (
                      <button 
                        onClick={(e) => handleConnect(vps.id, e)}
                        disabled={connecting === vps.id}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 min-w-[100px] flex items-center justify-center space-x-2"
                      >
                        {connecting === vps.id ? <Loader2 size={16} className="animate-spin" /> : <><Power size={16} /> <span className="uppercase tracking-widest">Connect</span></>}
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => handleDisconnect(vps.id, e)}
                        className="px-8 py-3 bg-bg-secondary hover:bg-red-500 hover:text-white text-text-muted text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm"
                      >
                        <PowerOff size={16} />
                        <span className="uppercase tracking-widest">Off</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
