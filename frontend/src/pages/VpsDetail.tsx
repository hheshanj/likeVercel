import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal as TerminalIcon, Folder, Activity, ExternalLink, Globe2 } from 'lucide-react';
import api from '../utils/api';
import XtermTerminal from '../components/Terminal/XtermTerminal';
import FileManager from '../components/VPS/FileManager';
import ProcessManager from '../components/VPS/ProcessManager';
import PortManager from '../components/VPS/PortManager';
import ProxyManager from '../components/VPS/ProxyManager';

const VpsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'terminal' | 'files' | 'processes' | 'ports' | 'domains'>('terminal');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get(`/vps/${id}`);
        setProfile(data.profile);
      } catch (err) {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProfile();
  }, [id, navigate]);

  if (loading) return <div className="flex-center" style={{ height: '100%' }}>Loading...</div>;
  if (!profile) return null;

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={18} /> },
    { id: 'files', label: 'Files', icon: <Folder size={18} /> },
    { id: 'processes', label: 'Processes', icon: <Activity size={18} /> },
    { id: 'ports', label: 'Ports', icon: <ExternalLink size={18} /> },
    { id: 'domains', label: 'Domains', icon: <Globe2 size={18} /> },
  ];

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <button 
        className="btn-link" 
        onClick={() => navigate('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{profile.name}</h1>
          <p className="text-secondary">{profile.username}@{profile.host}:{profile.port}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '10px', 
            height: '10px', 
            borderRadius: '50%', 
            background: profile.isConnected ? 'var(--success)' : 'var(--error)' 
          }} />
          <span style={{ fontWeight: 500 }}>{profile.isConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-4) var(--space-6)',
                border: 'none',
                background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.2s ease'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 'var(--space-4)', overflow: 'hidden' }}>
          {activeTab === 'terminal' && (
            profile.isConnected ? (
              <XtermTerminal vpsId={profile.id} />
            ) : (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-secondary">Please connect to the VPS first to open a terminal session.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard to Connect
                </button>
              </div>
            )
          )}
          {activeTab === 'files' && (
            profile.isConnected ? (
              <FileManager vpsId={profile.id} />
            ) : (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-secondary">Connect to the VPS to browse files.</p>
              </div>
            )
          )}
          {activeTab === 'processes' && (
            profile.isConnected ? (
              <ProcessManager vpsId={profile.id} />
            ) : (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-secondary">Connect to the VPS to manage deployments.</p>
              </div>
            )
          )}
          {activeTab === 'ports' && (
            profile.isConnected ? (
              <PortManager vpsId={profile.id} />
            ) : (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-secondary">Connect to the VPS to view active ports.</p>
              </div>
            )
          )}
          {activeTab === 'domains' && (
            profile.isConnected ? (
              <ProxyManager vpsId={profile.id} />
            ) : (
              <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-secondary">Connect to the VPS to manage domains.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default VpsDetail;
