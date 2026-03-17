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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load proxy configs');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to install Nginx');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create proxy');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete proxy');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'SSL setup failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Show Nginx install prompt if not installed
  if (!loading && !nginxInstalled) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="glass-panel flex-center" style={{ padding: 'var(--space-8)', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
          <Globe size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Nginx Not Installed</h3>
          <p className="text-secondary" style={{ textAlign: 'center', maxWidth: '400px', fontSize: '0.9rem' }}>
            Nginx is required to manage domain proxy configurations. Install it with one click to get started.
          </p>
          <button className="btn btn-primary" onClick={handleInstallNginx} disabled={installing} style={{ marginTop: 'var(--space-2)' }}>
            {installing ? <><Loader2 size={16} className="spin" /> Installing Nginx...</> : <><Download size={16} /> Install Nginx</>}
          </button>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>{error}</p>}
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '2px' }}>Domains & Proxy</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {configs.length} domain{configs.length !== 1 ? 's' : ''} mapped
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={fetchConfigs} style={{ padding: '8px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: '8px 16px' }}>
            <Plus size={16} /> Add Domain
          </button>
        </div>
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

      {/* New Domain Form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-primary)', padding: 'var(--space-4)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Map Domain to Port</h4>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 120px', gap: 'var(--space-2)', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Domain</label>
              <input
                className="input-field"
                placeholder="app.yourdomain.com"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                required
              />
            </div>
            <ArrowRight size={20} style={{ color: 'var(--text-muted)', marginTop: '16px' }} />
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Port</label>
              <input
                className="input-field"
                type="number"
                placeholder="3000"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                required
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={form.ssl}
              onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <Lock size={14} />
            Enable SSL (HTTPS) — auto-installs Certbot & Let's Encrypt
          </label>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Make sure your domain's DNS A record points to your VPS IP before creating the proxy.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating || !form.domain || !form.port}>
              {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Globe size={16} /> Create Proxy</>}
            </button>
          </div>
        </form>
      )}

      {/* Config List */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading ? (
          <div className="flex-center" style={{ height: '200px', gap: 'var(--space-2)' }}>
            <Loader2 size={20} className="spin" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-muted">Loading proxy configs…</span>
          </div>
        ) : configs.length === 0 && !showForm ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Globe size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div style={{ textAlign: 'center' }}>
              <p className="text-muted" style={{ marginBottom: 'var(--space-2)' }}>No domains mapped yet</p>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} /> Map Your First Domain
              </button>
            </div>
          </div>
        ) : (
          configs.map((cfg) => (
            <div
              key={cfg.domain}
              style={{
                background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)', padding: 'var(--space-3) var(--space-4)',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {/* SSL status badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    background: cfg.ssl ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: cfg.ssl ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {cfg.ssl ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {cfg.ssl ? 'HTTPS' : 'HTTP'}
                  </span>

                  {/* Domain name */}
                  <a
                    href={`${cfg.ssl ? 'https' : 'http'}://${cfg.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    {cfg.domain} <ExternalLink size={12} />
                  </a>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {!cfg.ssl && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => handleEnableSSL(cfg.domain)}
                      disabled={actionLoading === `ssl-${cfg.domain}`}
                      title="Enable HTTPS"
                    >
                      {actionLoading === `ssl-${cfg.domain}` ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <><Lock size={12} /> SSL</>
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleDelete(cfg.domain)}
                    disabled={actionLoading === `delete-${cfg.domain}`}
                    title="Delete Proxy"
                  >
                    {actionLoading === `delete-${cfg.domain}` ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              {/* Bottom row — routing info */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{cfg.domain}</span>
                <ArrowRight size={12} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>localhost:{cfg.port}</span>
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  background: cfg.enabled ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: cfg.enabled ? 'var(--success)' : 'var(--error)',
                }}>
                  {cfg.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ProxyManager;
