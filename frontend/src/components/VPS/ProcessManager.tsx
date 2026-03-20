import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  ScrollText,
  Plus,
  X,
  Loader2,
  Rocket,
  ChevronDown,
  Clock,
  FolderOpen,
  ExternalLink,
  Search,
  Activity,
  Filter,
  Maximize2
} from 'lucide-react';
import api from '../../utils/api';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../../context/ToastContext';

interface Deployment {
  id: string;
  vpsId: string;
  projectPath: string;
  processName: string;
  port: number;
  status: string;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  actualStatus?: string;
  cpu?: number;
  memory?: number;
  projectType?: string;
  url?: string;
}

interface UnmanagedProcess {
  processName: string;
  status: string;
  cpu: number;
  memory: number;
  pm_id?: number;
  port?: number;
  pid?: number;
  type?: 'pm2' | 'port';
}

interface ProcessManagerProps {
  vpsId: string;
}

function getStatusClasses(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'stopping':
    case 'launching':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'errored':
      return 'bg-red-500/10 text-red-100 border-red-500/30';
    default:
      return 'bg-bg-tertiary text-text-secondary border-border-light';
  }
}

function getDotColor(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return 'bg-emerald-500';
    case 'stopping':
    case 'launching':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
}

const ProcessManager: React.FC<ProcessManagerProps> = ({ vpsId }) => {
  const { showToast } = useToast();
  const logBodyRef = useRef<HTMLDivElement>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [unmanaged, setUnmanaged] = useState<UnmanagedProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ id: string; name: string; logs: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployForm, setDeployForm] = useState({ projectPath: '', port: '', command: '', processName: '' });
  const [deploying, setDeploying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isFetching = useRef(false);

  const fetchProcesses = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/processes`);
      setDeployments(data.processes);
      setUnmanaged(data.unmanagedProcesses || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load processes');
    } finally {
      if (!silent) setLoading(false);
      isFetching.current = false;
    }
  }, [vpsId]);

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(() => fetchProcesses(true), 15000);
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  const handleDeploy = async () => {
    if (!deployForm.projectPath.trim()) return;
    setDeploying(true);
    setError('');
    try {
      const body: any = { projectPath: deployForm.projectPath };
      if (deployForm.port) body.port = parseInt(deployForm.port);
      if (deployForm.command) body.command = deployForm.command;
      if (deployForm.processName) body.processName = deployForm.processName;

      await api.post(`/vps/${vpsId}/processes/start`, body);
      setShowDeploy(false);
      setDeployForm({ projectPath: '', port: '', command: '', processName: '' });
      setShowAdvanced(false);
      fetchProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleAction = async (deploymentId: string, action: 'stop' | 'restart' | 'delete') => {
    if (action === 'delete') {
      setConfirmDeleteId(deploymentId);
      return;
    }
    setActionLoading(`${deploymentId}-${action}`);
    try {
      await api.post(`/vps/${vpsId}/processes/${deploymentId}/${action}`);
      showToast(`Process ${action}ed`, 'success');
      fetchProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDeleteDeployment = async () => {
    if (!confirmDeleteId) return;
    setActionLoading(`${confirmDeleteId}-delete`);
    try {
      await api.delete(`/vps/${vpsId}/processes/${confirmDeleteId}`);
      showToast('Deployment removed', 'success');
      fetchProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionLoading(null);
      setConfirmDeleteId(null);
    }
  };

  const handleViewLogs = async (deploymentId: string, processName: string) => {
    setLogLoading(true);
    setLogModal({ id: deploymentId, name: processName, logs: '' });
    try {
      const { data } = await api.get(`/vps/${vpsId}/processes/${deploymentId}/logs`, {
        params: { lines: 200 },
      });
      setLogModal({ id: deploymentId, name: processName, logs: data.logs });
    } catch (err: any) {
      setLogModal({ id: deploymentId, name: processName, logs: `Error loading logs: ${err.response?.data?.error || err.message}` });
    } finally {
      setLogLoading(false);
    }
  };

  const handleAdopt = async (proc: UnmanagedProcess) => {
    const actionKey = proc.pm_id ? `adopt-${proc.pm_id}` : `adopt-${proc.port}`;
    setActionLoading(actionKey);
    try {
      await api.post(`/vps/${vpsId}/processes/adopt`, {
        pm_id: proc.pm_id,
        processName: proc.processName,
        port: proc.port,
        pid: proc.pid,
        type: proc.type,
      });
      showToast('Process adopted successfully', 'success');
      fetchProcesses();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Adoption failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (logBodyRef.current && logModal?.logs) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, [logModal?.logs]);

  const filteredDeployments = deployments.filter(d => 
    d.processName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.projectPath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-xs group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search processes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-secondary border border-border-light rounded-xl pl-10 pr-4 py-2 text-xs text-text-primary outline-none focus:border-blue-500/50 transition-all focus:ring-4 focus:ring-blue-500/5"
          />
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <Filter size={18} />
          </button>
          <button 
            onClick={() => setShowDeploy(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl shadow-xl active:scale-95"
          >
            <Plus size={16} />
            <span>New App</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-3">
            <X size={18} />
            <span className="text-xs font-bold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded transition-all">
            <X size={14} />
          </button>
        </div>
      )}

      {showDeploy && (
        <div className="p-6 bg-bg-secondary/90 backdrop-blur-md border border-blue-500/20 rounded-2xl space-y-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Rocket className="text-blue-500" size={20} />
              <h4 className="font-bold text-text-primary tracking-tight text-[13px]">Initialize Deploy</h4>
            </div>
            <button onClick={() => setShowDeploy(false)} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">Target Path</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50" size={16} />
                <input
                  placeholder="/var/www/my-node-app"
                  value={deployForm.projectPath}
                  onChange={(e) => setDeployForm({ ...deployForm, projectPath: e.target.value })}
                  className="w-full bg-bg-primary border border-border-light rounded-xl pl-10 pr-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-[10px] font-bold text-text-muted hover:text-text-primary transition-colors uppercase tracking-widest"
            >
              <ChevronDown size={14} className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
              <span>Advanced Protocol</span>
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">Binding Port</label>
                  <input
                    placeholder="Auto"
                    type="number"
                    value={deployForm.port}
                    onChange={(e) => setDeployForm({ ...deployForm, port: e.target.value })}
                    className="w-full bg-bg-primary border border-border-light rounded-xl px-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted mb-2 uppercase tracking-widest">Entry Call</label>
                  <input
                    placeholder="e.g. npm start"
                    value={deployForm.command}
                    onChange={(e) => setDeployForm({ ...deployForm, command: e.target.value })}
                    className="w-full bg-bg-primary border border-border-light rounded-xl px-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500 transition-all font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button onClick={() => setShowDeploy(false)} className="px-6 py-2 text-text-muted hover:text-text-primary font-bold text-xs transition-colors">Discard</button>
            <button 
              onClick={handleDeploy} 
              disabled={deploying || !deployForm.projectPath.trim()}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl text-xs transition-all disabled:opacity-50"
            >
              {deploying ? <Loader2 size={16} className="animate-spin" /> : 'Launch'}
            </button>
          </div>
        </div>
      )}

      {/* Deployments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 animate-pulse">
            <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
            <span className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Scanning Workloads...</span>
          </div>
        ) : (
          <>
            {filteredDeployments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 border border-dashed border-border-light rounded-[32px] bg-bg-secondary/10">
                <div className="p-6 bg-bg-secondary rounded-full mb-6 border border-border-light">
                  <Rocket size={48} className="text-text-muted/30" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2 tracking-tight">No Active Deploys</h3>
                <p className="text-text-muted text-center max-w-sm mb-10 text-xs font-medium leading-relaxed">Initialize application clusters on target host to begin orchestration.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredDeployments.map((dep) => {
                  const status = dep.actualStatus || dep.status;
                  const isOnline = status === 'online' || status === 'running';
                  
                  return (
                    <div key={dep.id} className="group premium-card glass-effect rounded-[24px] border border-border-light hover:border-blue-500/30 transition-all duration-300 overflow-hidden shadow-xl">
                      <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                        <div className="flex items-center space-x-4">
                          <div className={`p-4 rounded-2xl ${status === 'online' ? 'icon-grad-blue shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-bg-tertiary'} transition-all shadow-inner`}>
                             <Activity size={24} className={status === 'online' ? 'text-white' : 'text-text-muted'} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-3 mb-1.5">
                              <h5 className="font-bold text-text-primary truncate max-w-[150px] sm:max-w-xs tracking-tight text-[13px]">{dep.processName}</h5>
                              <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border ${getStatusClasses(status)} shadow-sm`}>
                                 <div className={`h-1.5 w-1.5 rounded-full ${getDotColor(status)} ${isOnline ? 'animate-pulse-soft shadow-[0_0_8px_currentColor]' : ''}`} />
                                 <span className="text-[9px] font-bold uppercase tracking-widest">{status}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-[10px] font-medium text-text-muted tracking-wide">
                               <span className="flex items-center space-x-2"><FolderOpen size={10} /> <span className="truncate max-w-[150px]">{dep.projectPath}</span></span>
                               <span className="flex items-center space-x-2"><ExternalLink size={10} /> <span>Port: {dep.port}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewLogs(dep.id, dep.processName)}
                            className="p-3 bg-bg-tertiary hover:bg-bg-tertiary/70 text-text-secondary rounded-xl transition-all border border-border-light"
                            title="View Logs"
                          >
                            <ScrollText size={18} />
                          </button>
                          
                          {!isOnline ? (
                            <button
                              onClick={() => handleAction(dep.id, 'restart')}
                              className="p-3 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-600/10"
                              disabled={actionLoading === `${dep.id}-restart`}
                            >
                              {actionLoading === `${dep.id}-restart` ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAction(dep.id, 'restart')}
                                className="p-3 bg-bg-tertiary hover:bg-bg-tertiary/70 text-text-secondary rounded-xl transition-all border border-border-light"
                                disabled={actionLoading === `${dep.id}-restart`}
                                title="Restart"
                              >
                                {actionLoading === `${dep.id}-restart` ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                              </button>
                              <button
                                onClick={() => handleAction(dep.id, 'stop')}
                                className="p-3 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all border border-red-500/20"
                                disabled={actionLoading === `${dep.id}-stop`}
                                title="Stop"
                              >
                                {actionLoading === `${dep.id}-stop` ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} fill="currentColor" />}
                              </button>
                            </>
                          )}

                          <div className="w-px h-6 bg-border-light mx-1" />

                          <button
                            onClick={() => handleAction(dep.id, 'delete')}
                            className="p-3 bg-bg-tertiary hover:bg-red-500 hover:text-white text-text-muted rounded-xl transition-all border border-border-light"
                            disabled={actionLoading === `${dep.id}-delete`}
                          >
                            {actionLoading === `${dep.id}-delete` ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unmanaged Processes - Outside the managed deployments check */}
            {unmanaged.filter(p => 
              p.processName.toLowerCase().includes(searchTerm.toLowerCase())
            ).length > 0 && (
              <>
                <div className="flex items-center space-x-3 mt-10 mb-4 px-1">
                  <Activity className="text-amber-500" size={18} />
                  <h3 className="text-[11px] font-bold text-text-muted tracking-tight uppercase tracking-widest">External Workloads detected</h3>
                </div>
                {unmanaged.filter(p => 
                  p.processName.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((proc) => (
                  <div key={proc.pm_id || `port-${proc.port}`} className="group premium-card glass-effect rounded-[24px] border border-border-light bg-amber-500/[0.02] hover:border-amber-500/30 transition-all duration-300 overflow-hidden shadow-xl">
                    <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                      <div className="flex items-center space-x-4">
                        <div className={`p-4 rounded-2xl ${proc.type === 'port' ? 'icon-grad-amber shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'icon-grad-indigo shadow-[0_0_20px_rgba(79,70,229,0.2)]'} transition-all shadow-inner`}>
                          <Activity size={24} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-3 mb-1.5">
                            <h5 className="font-bold text-text-primary tracking-tight text-[13px]">{proc.processName}</h5>
                            <div className="px-2.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-500 text-[9px] font-bold uppercase tracking-widest">
                               {proc.type === 'port' ? 'RAW PORT' : 'UNMANAGED'}
                            </div>
                          </div>
                          <p className="text-[10px] font-medium text-text-muted tracking-wide flex items-center space-x-2">
                             <span className={`h-1.5 w-1.5 rounded-full ${proc.status === 'online' || proc.status === 'running' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                             <span>Status: {proc.status}</span>
                             <span className="opacity-30">|</span>
                             <span>{proc.pm_id ? `PM2 ID: ${proc.pm_id}` : `PORT: ${proc.port}`}</span>
                          </p>
                        </div>
                      </div>

                      <button 
                       onClick={() => handleAdopt(proc)}
                       disabled={actionLoading === (proc.pm_id ? `adopt-${proc.pm_id}` : `adopt-${proc.port}`)}
                       className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-xl transition-all border border-blue-600 shadow-xl shadow-blue-600/10 uppercase tracking-widest disabled:opacity-50 flex items-center space-x-2"
                      >
                        {actionLoading === (proc.pm_id ? `adopt-${proc.pm_id}` : `adopt-${proc.port}`) ? <Loader2 size={14} className="animate-spin" /> : <span>Take Control</span>}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Log Modal */}
      {logModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300" onClick={() => setLogModal(null)}>
          <div className="bg-bg-primary w-full max-w-5xl h-full max-h-[85vh] rounded-[32px] border border-border-light flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border-light flex items-center justify-between bg-bg-secondary/40 rounded-t-[32px]">
              <div>
                <div className="flex items-center space-x-2 text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1">
                  <ScrollText size={14} />
                  <span>Interactive Log Stream</span>
                </div>
                <h3 className="text-lg font-bold text-text-primary tracking-tight">{logModal.name}</h3>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => handleViewLogs(logModal.id, logModal.name)}
                  className="p-2.5 bg-bg-tertiary hover:bg-bg-tertiary/70 text-text-secondary rounded-xl transition-all"
                >
                  <RotateCcw size={20} className={logLoading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => setLogModal(null)}
                  className="p-2.5 bg-bg-tertiary hover:bg-red-500 text-white rounded-xl transition-all shadow-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div ref={logBodyRef} className="flex-1 bg-black p-8 overflow-auto custom-scrollbar font-mono text-xs leading-relaxed text-slate-300 selection:bg-blue-500/30">
               {logLoading ? (
                 <div className="h-full flex flex-col items-center justify-center space-y-4">
                   <Loader2 size={40} className="text-blue-500 animate-spin opacity-50" />
                   <p className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Ingesting Log Buffer...</p>
                 </div>
               ) : (
                 <pre className="whitespace-pre-wrap break-all">
                   {logModal.logs || 'No active buffer output detected for this process.'}
                 </pre>
               )}
            </div>

            <div className="p-5 border-t border-border-light bg-bg-secondary/40 flex items-center justify-between px-8 rounded-b-[32px]">
               <div className="flex items-center space-x-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  <Clock size={14} />
                  <span>Last Refresh: {new Date().toLocaleTimeString()}</span>
               </div>
               <button className="flex items-center space-x-2 text-[10px] font-bold text-blue-500/80 uppercase tracking-widest hover:text-blue-500 transition-colors">
                  <Maximize2 size={14} />
                  <span>Scale View</span>
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Deployment Modal */}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Deployment"
          message="Remove this PM2 process permanently? The app will stop and the managed entry will be deleted."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteDeployment}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

export default ProcessManager;
