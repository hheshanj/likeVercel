import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  X,
  Loader2,
  Globe,
  Settings,
  Zap,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import api from '../../utils/api';

interface ManagedPort {
  port: number;
  processName: string;
  projectPath: string;
  url: string;
}

interface PortManagerProps {
  vpsId: string;
}

const PortManager: React.FC<PortManagerProps> = ({ vpsId }) => {
  const [activePorts, setActivePorts] = useState<number[]>([]);
  const [managedPorts, setManagedPorts] = useState<ManagedPort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkPort, setCheckPort] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ port: number; available: boolean; message: string } | null>(null);

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/ports`);
      setActivePorts(data.activePorts);
      setManagedPorts(data.managedPorts);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load ports');
    } finally {
      setLoading(false);
    }
  }, [vpsId]);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  const handleCheckPort = async () => {
    if (!checkPort) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await api.post(`/vps/${vpsId}/ports/check`, { port: checkPort });
      setCheckResult(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-500">
      {/* Port Checker Card */}
      <div className="glass-effect rounded-[32px] p-8 border border-border-light relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <Zap size={96} />
         </div>
         
         <div className="flex items-center space-x-3 mb-8">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
               <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-text-primary tracking-tight">Security Port Auditor</h3>
         </div>

         <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center relative z-10">
            <div className="relative flex-1 w-full sm:max-w-xs">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-[10px] font-bold uppercase tracking-widest">Port</span>
               <input
                type="number"
                placeholder="Ex. 8080"
                value={checkPort}
                onChange={(e) => setCheckPort(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckPort()}
                className="w-full bg-bg-primary/80 border border-border-light rounded-2xl pl-16 pr-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500 transition-all font-mono shadow-inner"
              />
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto">
               <button 
                  onClick={handleCheckPort} 
                  disabled={checking || !checkPort}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50"
               >
                  {checking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  <span>Scan</span>
               </button>
               <button 
                  onClick={fetchPorts}
                  className="p-3 bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary rounded-xl transition-all border border-border-light shadow-lg"
               >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
               </button>
            </div>
         </div>

         {checkResult && (
           <div className={`mt-6 p-4 rounded-2xl border flex items-center space-x-3 animate-in slide-in-from-top-4 ${
             checkResult.available 
             ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
             : 'bg-red-500/10 border-red-500/20 text-red-500'
           }`}>
             {checkResult.available ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
             <span className="text-xs font-bold leading-relaxed">{checkResult.message}</span>
           </div>
         )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Managed Ports Section */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3 px-1">
             <Activity className="text-emerald-500" size={18} />
             <h3 className="text-[11px] font-bold text-text-muted tracking-tight">Public Service Sockets</h3>
          </div>
          
          <div className="space-y-3">
            {managedPorts.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-text-muted glass-effect rounded-[32px] border border-border-light border-dashed uppercase tracking-widest">
                 No active endpoint maps.
              </div>
            ) : (
              managedPorts.map((mp) => (
                <div key={mp.port} className="group glass-effect rounded-[24px] p-4 border border-border-light hover:border-emerald-500/30 transition-all flex items-center justify-between shadow-xl">
                  <div className="flex items-center space-x-4">
                     <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                        <Globe size={20} />
                     </div>
                     <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary tracking-tight truncate max-w-[150px] md:max-w-xs">{mp.processName}</h4>
                        <div className="flex items-center mt-1 space-x-3">
                           <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">Port {mp.port}</span>
                           <span className="text-[9px] font-bold text-text-muted truncate max-w-[100px] font-mono">{mp.projectPath}</span>
                        </div>
                     </div>
                  </div>
                  <a 
                    href={mp.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-3 bg-bg-secondary/50 hover:bg-emerald-500 hover:text-white text-text-muted rounded-xl transition-all border border-border-light shadow-inner"
                  >
                    <ArrowUpRight size={18} />
                  </a>
                </div>
              ))
            )}
          </div>
        </section>

        {/* System Listening Ports Section */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3 px-1">
             <Settings className="text-amber-500" size={18} />
             <h3 className="text-[11px] font-bold text-text-muted tracking-tight">Host Listening Grid</h3>
          </div>
          
          <div className="glass-effect rounded-[32px] border border-border-light p-6 shadow-xl min-h-[160px] flex items-center justify-center">
            {activePorts.length === 0 ? (
              <div className="flex flex-col items-center space-y-3 opacity-40">
                 <Settings size={32} className="text-text-muted" />
                 <p className="text-text-muted font-bold uppercase tracking-widest text-[10px]">No listening ports detected</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 w-full">
                {activePorts.map((port) => (
                  <span key={port} className="px-3 py-1.5 bg-bg-primary border border-border-light rounded-xl text-[11px] font-bold font-mono text-amber-500 shadow-2xl hover:border-amber-500/40 transition-all cursor-default group hover:scale-110">
                    {port}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="px-5 py-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start space-x-3">
             <ShieldAlert size={16} className="text-amber-500/60 mt-0.5" />
             <p className="text-[10px] leading-relaxed text-amber-600/70 font-bold tracking-tight">
                Traffic Audit Note: Only authorized ingress ports should be exposed to public gateway protocols.
             </p>
          </div>
        </section>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-between text-xs font-bold animate-in shake-1">
          <div className="flex items-center space-x-3">
             <ShieldAlert size={18} />
             <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded-lg transition-all"><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default PortManager;
