import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  ScrollText,
  Cpu,
  HardDrive,
  Plus,
  X,
  Loader2,
  Rocket,
  ChevronDown,
  Clock,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import api from '../../utils/api';

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

interface ProcessManagerProps {
  vpsId: string;
}

function formatMemory(bytes: number): string {
  if (!bytes) return '0 MB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return 'var(--success)';
    case 'stopping':
    case 'launching':
      return 'var(--warning)';
    default:
      return 'var(--error)';
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return 'var(--success-bg)';
    case 'stopping':
    case 'launching':
      return 'var(--warning-bg)';
    default:
      return 'var(--error-bg)';
  }
}

const ProcessManager: React.FC<ProcessManagerProps> = ({ vpsId }) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployForm, setDeployForm] = useState({ projectPath: '', port: '', command: '' });
  const [deploying, setDeploying] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ id: string; name: string; logs: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/processes`);
      setDeployments(data.processes);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load processes');
    } finally {
      setLoading(false);
    }
  }, [vpsId]);

  useEffect(() => {
    fetchProcesses();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchProcesses, 10000);
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

      await api.post(`/vps/${vpsId}/processes/start`, body);
      setShowDeploy(false);
      setDeployForm({ projectPath: '', port: '', command: '' });
      setShowAdvanced(false);
      fetchProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleAction = async (deploymentId: string, action: 'stop' | 'restart' | 'delete') => {
    setActionLoading(`${deploymentId}-${action}`);
    try {
      if (action === 'delete') {
        if (!confirm('Delete this deployment? The PM2 process will be removed.')) {
          setActionLoading(null);
          return;
        }
        await api.delete(`/vps/${vpsId}/processes/${deploymentId}`);
      } else {
        await api.post(`/vps/${vpsId}/processes/${deploymentId}/${action}`);
      }
      fetchProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '2px' }}>Deployments</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {deployments.length} process{deployments.length !== 1 ? 'es' : ''} managed
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowDeploy(true)} style={{ padding: '8px 16px' }}>
          <Rocket size={16} /> New Deployment
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--error-bg)', color: 'var(--error)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* New Deployment Form */}
      {showDeploy && (
        <div style={{
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-primary)', padding: 'var(--space-4)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Deploy Application</h4>
            <button onClick={() => { setShowDeploy(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project Path on Server *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FolderOpen size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                className="input-field"
                placeholder="/root/my-app"
                value={deployForm.projectPath}
                onChange={(e) => setDeployForm({ ...deployForm, projectPath: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Auto-detects: package.json → Node.js | requirements.txt → Python | index.html → Static
            </p>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: 0,
            }}
          >
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            Advanced Options
          </button>

          {showAdvanced && (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Port (optional)</label>
                <input
                  className="input-field"
                  placeholder="Auto-assigned"
                  type="number"
                  value={deployForm.port}
                  onChange={(e) => setDeployForm({ ...deployForm, port: e.target.value })}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Custom Command (optional)</label>
                <input
                  className="input-field"
                  placeholder="e.g. node server.js"
                  value={deployForm.command}
                  onChange={(e) => setDeployForm({ ...deployForm, command: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={() => { setShowDeploy(false); setError(''); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying || !deployForm.projectPath.trim()}>
              {deploying ? <><Loader2 size={16} className="spin" /> Deploying…</> : <><Rocket size={16} /> Deploy</>}
            </button>
          </div>
        </div>
      )}

      {/* Deployments List */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading ? (
          <div className="flex-center" style={{ height: '200px', gap: 'var(--space-2)' }}>
            <Loader2 size={20} className="spin" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-muted">Loading processes…</span>
          </div>
        ) : deployments.length === 0 && !showDeploy ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Rocket size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div style={{ textAlign: 'center' }}>
              <p className="text-muted" style={{ marginBottom: 'var(--space-2)' }}>No deployments yet</p>
              <button className="btn btn-primary" onClick={() => setShowDeploy(true)}>
                <Plus size={16} /> Create First Deployment
              </button>
            </div>
          </div>
        ) : (
          deployments.map((dep) => {
            const status = dep.actualStatus || dep.status;
            return (
              <div
                key={dep.id}
                style={{
                  background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)', padding: 'var(--space-3) var(--space-4)',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      background: getStatusBg(status), color: getStatusColor(status),
                    }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: getStatusColor(status),
                        boxShadow: status === 'online' || status === 'running' ? `0 0 6px ${getStatusColor(status)}` : 'none',
                      }} />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                      {dep.processName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(status === 'stopped' || status === 'errored') && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleAction(dep.id, 'restart')}
                        disabled={actionLoading === `${dep.id}-restart`}
                        title="Start"
                      >
                        {actionLoading === `${dep.id}-restart` ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                      </button>
                    )}
                    {(status === 'online' || status === 'running') && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => handleAction(dep.id, 'restart')}
                          disabled={actionLoading === `${dep.id}-restart`}
                          title="Restart"
                        >
                          {actionLoading === `${dep.id}-restart` ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => handleAction(dep.id, 'stop')}
                          disabled={actionLoading === `${dep.id}-stop`}
                          title="Stop"
                        >
                          {actionLoading === `${dep.id}-stop` ? <Loader2 size={14} className="spin" /> : <Square size={14} />}
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleViewLogs(dep.id, dep.processName)}
                      title="View Logs"
                    >
                      <ScrollText size={14} />
                    </button>
                    {dep.url && (
                      <a
                        href={dep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        title="View Site"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleAction(dep.id, 'delete')}
                      disabled={actionLoading === `${dep.id}-delete`}
                      title="Delete"
                    >
                      {actionLoading === `${dep.id}-delete` ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Bottom row - details */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                    <FolderOpen size={12} /> {dep.projectPath}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Port: <strong style={{ color: 'var(--text-primary)' }}>{dep.port}</strong>
                  </span>
                  {(status === 'online' || status === 'running') && (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={12} /> {(dep.cpu || 0).toFixed(1)}%
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HardDrive size={12} /> {formatMemory(dep.memory || 0)}
                      </span>
                    </>
                  )}
                  {dep.startedAt && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {new Date(dep.startedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Modal */}
      {logModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-6)',
          }}
          onClick={() => setLogModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)', width: '100%', maxWidth: '800px',
              maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)',
            }}>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>Logs</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{logModal.name}</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleViewLogs(logModal.id, logModal.name)}>
                  <RotateCcw size={14} /> Refresh
                </button>
                <button onClick={() => setLogModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-3)' }}>
              {logLoading ? (
                <div className="flex-center" style={{ height: '200px', gap: 'var(--space-2)' }}>
                  <Loader2 size={20} className="spin" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-muted">Loading logs…</span>
                </div>
              ) : (
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.6,
                  color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  margin: 0, padding: 'var(--space-2)', background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)', minHeight: '200px',
                }}>
                  {logModal.logs || 'No logs available.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spin animation (shared) */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ProcessManager;
