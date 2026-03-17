import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Plus,
  X,
  Loader2,
  Globe,
  Settings,
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load ports');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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

      {/* Port Checker */}
      <div className="glass-panel" style={{ padding: 'var(--space-4)', background: 'rgba(255,255,255,0.01)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
          Port Availability Checker
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="input-field"
            type="number"
            placeholder="Enter port (e.g. 8000)"
            value={checkPort}
            onChange={(e) => setCheckPort(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheckPort()}
            style={{ maxWidth: '200px' }}
          />
          <button className="btn btn-primary" onClick={handleCheckPort} disabled={checking || !checkPort}>
            {checking ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Check
          </button>
          <button className="btn btn-secondary" onClick={fetchPorts}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
        {checkResult && (
          <div style={{ 
            marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', 
            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            background: checkResult.available ? 'var(--success-bg)' : 'var(--error-bg)',
            color: checkResult.available ? 'var(--success)' : 'var(--error)',
            fontSize: '0.85rem'
          }}>
            {checkResult.available ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
            {checkResult.message}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Managed Ports (Deployments) */}
        <section>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Globe size={18} style={{ color: 'var(--success)' }} />
            App URLs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {managedPorts.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No active deployments with ports.</p>
            ) : (
              managedPorts.map((mp) => (
                <div key={mp.port} className="glass-panel" style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{mp.processName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>port {mp.port}</div>
                  </div>
                  <a 
                    href={mp.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Open <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                  </a>
                </div>
              ))
            )}
          </div>
        </section>

        {/* System Listening Ports */}
        <section>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Settings size={18} style={{ color: 'var(--warning)' }} />
            System Listening Ports
          </h3>
          <div style={{ 
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', 
            background: 'var(--bg-primary)', padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' 
          }}>
            {activePorts.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No active listening ports detected.</p>
            ) : (
              activePorts.map((port) => (
                <span key={port} style={{ 
                  background: 'var(--bg-tertiary)', padding: '2px 10px', 
                  borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', 
                  fontFamily: 'var(--font-mono)', border: '1px solid var(--border-color)'
                }}>
                  {port}
                </span>
              ))
            )}
          </div>
          <p style={{ marginTop: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            These are all active TCP ports currently listening on your VPS.
          </p>
        </section>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default PortManager;
