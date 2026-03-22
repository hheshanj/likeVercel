import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Download,
  Lock,
  Zap,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import api from '../../utils/api';

interface ProxyConfig {
  domain: string;
  port: number;
  ssl: boolean;
  enabled: boolean;
  fileName: string;
}

interface ProxyManagerProps {
  vpsId: string;
}

const ProxyManager: React.FC<ProxyManagerProps> = ({ vpsId }) => {
  const [configs, setConfigs] = useState<ProxyConfig[]>([]);
  const [nginxInstalled, setNginxInstalled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: '', port: '', ssl: false });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/proxy`);
      setConfigs(data.configs);
      setNginxInstalled(data.nginxInstalled);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load proxy configs');
    } finally {
      setLoading(false);
    }
  }, [vpsId]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleInstallNginx = async () => {
    setInstalling(true);
    setError('');
    try {
      await api.post(`/vps/${vpsId}/proxy/install-nginx`);
      setNginxInstalled(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to install Nginx');
    } finally {
      setInstalling(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domain || !form.port) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.post(`/vps/${vpsId}/proxy`, {
        domain: form.domain,
        port: parseInt(form.port),
        ssl: form.ssl,
      });
      if (res.data.sslError) {
        setError(`Proxy created, but SSL failed: ${res.data.sslError}`);
      }
      setShowForm(false);
      setForm({ domain: '', port: '', ssl: false });
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create proxy');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (domain: string) => {
    if (!confirm(`Remove proxy config for ${domain}?`)) return;
    setActionLoading(`delete-${domain}`);
    try {
      await api.delete(`/vps/${vpsId}/proxy/${domain}`);
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete proxy');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnableSSL = async (domain: string) => {
    setActionLoading(`ssl-${domain}`);
    setError('');
    try {
      await api.post(`/vps/${vpsId}/proxy/${domain}/ssl`);
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'SSL setup failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (!loading && !nginxInstalled) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center animate-in fade-in duration-500">
         <div className="p-10 bg-bg-secondary/80 backdrop-blur-xl border border-border-light rounded-[32px] shadow-2xl relative max-w-lg">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 p-6 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/40">
               <Globe size={48} className="text-white" />
            </div>
            
            <h3 className="text-2xl font-bold text-text-primary mt-10 mb-4 tracking-tighter">Proxy core missing</h3>
            <p className="text-text-muted mb-10 leading-relaxed font-bold tracking-tight text-xs">
              Edge routing and SSL protocols depend on the Nginx reverse proxy service. Establish this host protocol to continue.
            </p>
            
            <button 
               onClick={handleInstallNginx} 
               disabled={installing}
               className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
               {installing ? <Loader2 size={24} className="animate-spin" /> : <><Download size={20} /> <span className="uppercase tracking-widest">Initialize Nginx</span></>}
            </button>
            
            {error && <p className="mt-6 text-red-500 font-bold bg-red-400/5 p-4 rounded-xl border border-red-500/20 text-xs">{error}</p>}
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-1">
             <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
             <span>Edge Gateway Suite</span>
          </div>
          <h3 className="text-xl font-bold text-text-primary tracking-tight">External Proxies</h3>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button 
             onClick={fetchConfigs}
             className="p-3 bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary rounded-xl transition-all border border-border-light shadow-md"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
             onClick={() => setShowForm(true)}
             className="flex-1 sm:flex-none flex items-center justify-center space-x-3 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xl active:scale-95"
          >
            <Plus size={20} />
            <span>Map Domain</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-between text-xs font-bold animate-in slide-in-from-top-4">
          <div className="flex items-center space-x-3">
             <ShieldAlert size={20} />
             <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded-lg"><X size={18} /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-bg-secondary rounded-[32px] border border-blue-500/30 p-8 shadow-2xl space-y-8 animate-in slide-in-from-top-4 duration-300 relative z-20">
           <div className="flex items-center justify-between border-b border-border-light pb-6 -mx-2">
              <div className="flex items-center space-x-3">
                 <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                    <Zap className="text-white" size={18} />
                 </div>
                 <h4 className="text-base font-bold text-text-primary tracking-tight">New Routing Rule</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded-xl transition-all"
              >
                <X size={20} />
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-end">
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-text-muted mb-3 uppercase tracking-widest pl-1">Target Domain</label>
                 <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-bg-tertiary/50 rounded-lg group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                       <Globe size={14} />
                    </div>
                    <input
                      className="w-full bg-bg-primary border border-border-light rounded-2xl pl-14 pr-4 py-4 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-mono shadow-sm"
                      placeholder="cloud.example.com"
                      value={form.domain}
                      onChange={(e) => setForm({ ...form, domain: e.target.value })}
                      required
                    />
                 </div>
              </div>
              
              <div className="hidden md:flex justify-center pb-5 text-text-muted opacity-40">
                 <ArrowRight size={20} />
              </div>

              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-text-muted mb-3 uppercase tracking-widest pl-1">Internal Port</label>
                 <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-bg-tertiary/50 rounded-lg group-focus-within:bg-blue-600 group-focus-within:text-white transition-all">
                       <Zap size={14} />
                    </div>
                    <input
                      className="w-full bg-bg-primary border border-border-light rounded-2xl pl-14 pr-4 py-4 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-mono shadow-sm"
                      type="number"
                      placeholder="3000"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                      required
                    />
                 </div>
              </div>
           </div>

           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4 border-t border-border-light -mx-2 px-2">
              <label 
                className={`cursor-pointer group flex items-center space-x-4 p-4 pr-10 rounded-2xl border transition-all ${
                  form.ssl 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                  : 'bg-bg-primary border-border-light text-text-muted hover:border-text-secondary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.ssl}
                  onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
                  className="hidden"
                />
                <div className={`p-2.5 rounded-xl transition-all shadow-lg ${form.ssl ? 'bg-emerald-500 text-white' : 'bg-bg-tertiary'}`}>
                  {form.ssl ? <ShieldCheck size={18} /> : <Lock size={18} />}
                </div>
                <div>
                   <span className="block font-bold text-[11px] tracking-tight">Auto SSL (Let's Encrypt)</span>
                   <span className="block text-[8px] font-bold uppercase tracking-tight opacity-60">Automatic provisioning</span>
                </div>
              </label>

              <div className="flex items-center space-x-3">
                 <button 
                   type="button" 
                   className="px-6 py-3 text-text-muted hover:text-red-500 font-bold text-xs transition-colors rounded-xl hover:bg-red-500/5" 
                   onClick={() => setShowForm(false)}
                 >
                    Discard Changes
                 </button>
                 <button 
                   type="submit" 
                   className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/20 text-xs transition-all active:scale-95 disabled:opacity-50 min-w-[180px]"
                   disabled={creating || !form.domain || !form.port}
                 >
                    {creating ? <Loader2 size={20} className="animate-spin" /> : 'Map Active Route'}
                 </button>
              </div>
           </div>

           <div className="flex items-center space-x-3 px-5 py-4 bg-bg-primary/50 border border-border-light border-dashed rounded-2xl">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <HelpCircle size={16} className="text-blue-500" />
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed tracking-tight font-bold">
                <span className="text-text-primary mr-1">Pre-Validation:</span>
                DNS CNAME or A-Record must resolve to this host before SSL activation.
              </p>
           </div>
        </form>
      )}

      {/* Config List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
            <span className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Syncing proxy cluster...</span>
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 border border-dashed border-border-light rounded-[32px] bg-bg-secondary/10">
            <div className="p-8 bg-bg-secondary rounded-3xl mb-8 border border-border-light shadow-inner">
              <Globe size={56} className="text-text-muted/30" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-3 tracking-tight">No connectors defined</h3>
            <p className="text-text-muted text-center max-w-sm mb-12 text-xs font-bold leading-relaxed">Map custom domains to internal host ports with automatic TLS protocols.</p>
          </div>
        ) : (
          configs.map((cfg) => (
            <div key={cfg.domain} className="group glass-effect rounded-[32px] border border-border-light hover:border-blue-500/30 transition-all duration-300 overflow-hidden shadow-2xl">
               <div className="p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div className="flex items-center space-x-5">
                     <div className={`p-5 rounded-2xl ${cfg.enabled ? 'bg-blue-600/10' : 'bg-bg-tertiary'} shadow-inner border border-border-light`}>
                        <Globe size={28} className={cfg.enabled ? 'text-blue-500' : 'text-text-muted'} />
                     </div>
                     <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                           <h4 className="text-base font-bold text-text-primary tracking-tight font-mono truncate max-w-[300px]">{cfg.domain}</h4>
                           <div className={`flex items-center mt-0.5 space-x-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                              cfg.ssl ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                           }`}>
                              {cfg.ssl ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                              <span>{cfg.ssl ? 'SSL Enforced' : 'Unsecured'}</span>
                           </div>
                        </div>
                        <div className="flex items-center space-x-3 text-[10px] font-bold font-mono">
                           <span className="text-text-muted uppercase tracking-widest bg-black/5 px-2 py-0.5 rounded-lg border border-border-light">Backend</span>
                           <span className="text-blue-500 tracking-widest">127.0.0.1:{cfg.port}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between xl:justify-end gap-4 border-t xl:border-t-0 border-border-light pt-6 xl:pt-0">
                     <div className="flex items-center space-x-2 mr-3 hidden 2xl:flex">
                        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border ${
                           cfg.enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                           <CheckCircle size={14} />
                           <span className="text-[9px] font-bold uppercase tracking-widest">{cfg.enabled ? 'Active' : 'Idle'}</span>
                        </div>
                     </div>

                     <div className="flex items-center space-x-2">
                        <a 
                          href={`${cfg.ssl ? 'https' : 'http'}://${cfg.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 bg-bg-secondary/50 hover:bg-bg-tertiary text-text-secondary rounded-xl transition-all border border-border-light shadow-inner"
                        >
                          <ExternalLink size={20} />
                        </a>
                        
                        {!cfg.ssl && (
                          <button
                            onClick={() => handleEnableSSL(cfg.domain)}
                            disabled={actionLoading === `ssl-${cfg.domain}`}
                            className="flex items-center space-x-2 px-6 py-3 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white font-bold tracking-tight text-[11px] rounded-xl border border-amber-500/20 transition-all active:scale-95"
                          >
                             {actionLoading === `ssl-${cfg.domain}` ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={16} /> <span>SSL Activate</span></>}
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(cfg.domain)}
                          disabled={actionLoading === `delete-${cfg.domain}`}
                          className="p-3 bg-bg-tertiary/50 hover:bg-red-500/20 hover:text-red-500 text-text-muted rounded-xl transition-all border border-border-light"
                        >
                           {actionLoading === `delete-${cfg.domain}` ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProxyManager;
