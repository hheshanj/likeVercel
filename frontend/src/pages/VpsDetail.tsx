import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Terminal as TerminalIcon,
  Folder,
  Activity,
  ExternalLink,
  Globe2,
  Settings as SettingsIcon,
  PlugZap,
  Zap,
  Server
} from 'lucide-react';
import api from '../utils/api';
import XtermTerminal from '../components/Terminal/XtermTerminal';
import FileManager from '../components/VPS/FileManager';
import ProcessManager from '../components/VPS/ProcessManager';
import PortManager from '../components/VPS/PortManager';
import ProxyManager from '../components/VPS/ProxyManager';
import ResourceChart from '../components/VPS/ResourceChart';

// Shared offline state shown on all tabs when VPS is disconnected
const OfflineState: React.FC<{ label: string; onNavigate: () => void }> = ({ label, onNavigate }) => (
  <div className="glass-effect rounded-[32px] p-16 text-center border border-border-light flex flex-col items-center space-y-6 h-full justify-center">
    <div className="p-5 bg-bg-secondary rounded-full border border-border-light">
      <PlugZap size={36} className="text-text-muted/30" />
    </div>
    <div>
      <p className="text-sm font-bold text-text-primary mb-2">{label}</p>
      <p className="text-xs text-text-muted font-medium">This VPS must be connected to access this feature.</p>
    </div>
    <button
      onClick={onNavigate}
      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-xl shadow-blue-600/20"
    >
      Go to Dashboard to Connect
    </button>
  </div>
);

type Tab = 'terminal' | 'files' | 'processes' | 'ports' | 'domains';

interface VpsProfile {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  authType: string;
  isConnected: boolean;
}

const VpsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<VpsProfile | null>(null);
  const [specs, setSpecs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    ['terminal', 'files', 'processes', 'ports', 'domains'].includes(initialTab || '') ? (initialTab as Tab) : 'terminal'
  );

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get(`/vps/${id}`);
        setProfile(data.profile);
        if (data.profile.isConnected) fetchSpecs();
      } catch (err) {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    const fetchSpecs = async () => {
      try {
        const { data } = await api.get(`/vps/${id}/specs`);
        setSpecs(data);
      } catch (err) {
        console.error('Failed to fetch specs', err);
      }
    };
    if (id) fetchProfile();
  }, [id, navigate]);

  if (loading) return (
    <div className="flex flex-col h-full bg-bg-primary items-center justify-center space-y-4">
       <Zap size={32} className="text-blue-500 animate-pulse" />
       <span className="text-xs font-bold tracking-widest text-text-muted">Loading...</span>
    </div>
  );
  
  if (!profile) return null;

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={16} /> },
    { id: 'files', label: 'File Manager', icon: <Folder size={16} /> },
    { id: 'processes', label: 'App Deploy', icon: <Activity size={16} /> },
    { id: 'ports', label: 'Port Mapping', icon: <ExternalLink size={16} /> },
    { id: 'domains', label: 'Proxies', icon: <Globe2 size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Detail Header */}
      <div className="px-8 py-6 border-b border-border-light bg-bg-secondary/20">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors mb-5 group text-xs font-bold tracking-tight"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <div className={`p-3 rounded-2xl ${profile.isConnected ? 'bg-blue-600 text-white shadow-lg' : 'bg-bg-tertiary text-text-muted'} border border-border-light`}>
              <Server size={28} />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">{profile.name}</h1>
                {profile.isConnected ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 tracking-widest">
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-bg-tertiary text-text-muted border border-border-light tracking-widest">
                    Offline
                  </span>
                )}
              </div>
              <p className="mt-1 text-text-muted font-mono text-xs font-bold tracking-tight">
                {profile.username}@{profile.host}:{profile.port} 
                {specs?.region && <span className="ml-3 text-blue-500 opacity-80 uppercase tracking-widest">• {specs.region}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate(`/vps/${id}/edit`)}
              className="flex items-center space-x-2 px-6 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-bold text-xs rounded-xl border border-border-light transition-all shadow-sm active:scale-95 group h-[42px]"
            >
              <SettingsIcon size={16} className="text-text-muted group-hover:text-blue-500 transition-colors" />
              <span>Edit Settings</span>
            </button>
          </div>
        </div>

          {/* Live Resource Charts — only visible when connected */}
          {profile.isConnected && (
            <div className="mt-6 pt-5 border-t border-border-light">
            <ResourceChart vpsId={profile.id} isConnected={profile.isConnected} />
          </div>
        )}
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-8 border-b border-border-light bg-bg-secondary/10 flex space-x-8 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-3 py-4 border-b-2 transition-all font-bold text-xs tracking-tight ${
                activeTab === tab.id 
                ? 'border-blue-500 text-blue-500' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-blue-500' : 'text-text-muted'}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 px-8 py-8 overflow-y-auto custom-scrollbar">
            {/* Map over tabs to keep them alive but hidden when not active */}
            <div className={`h-full ${activeTab !== 'terminal' ? 'hidden' : 'block'}`}>
              {!profile.isConnected ? (
                <div className="h-full glass-effect rounded-[32px] flex flex-col items-center justify-center p-12 text-center border border-border-light">
                  <div className="p-8 bg-bg-secondary rounded-full mb-8 border border-border-light">
                    <TerminalIcon size={48} className="text-text-muted" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-3 tracking-tight">Terminal Locked</h3>
                  <p className="text-text-muted max-w-sm mb-10 text-xs font-medium leading-relaxed">Establish a connection from the core dashboard to initialize shell access.</p>
                  <button 
                    onClick={() => navigate('/dashboard')}
                    className="px-10 py-4 bg-bg-tertiary hover:bg-bg-tertiary/70 text-text-primary font-bold text-xs rounded-2xl border border-border-light transition-all shadow-xl"
                  >
                    Connect VPS
                  </button>
                </div>
              ) : (
                <div className="h-full rounded-2xl overflow-hidden border border-border-light shadow-2xl">
                  <XtermTerminal
                    vpsId={profile.id}
                    vpsHost={profile.host}
                    vpsUsername={profile.username}
                  />
                </div>
              )}
            </div>
            
            {activeTab === 'files' && (
              <div className="h-full">
                {profile.isConnected ? (
                  <FileManager vpsId={profile.id} />
                ) : (
                  <OfflineState label="Storage Access Restricted" onNavigate={() => navigate('/dashboard')} />
                )}
              </div>
            )}
            
            {activeTab === 'processes' && (
              <div className="animate-in fade-in duration-500">
                {profile.isConnected ? (
                  <ProcessManager vpsId={profile.id} />
                ) : (
                  <OfflineState label="Workload Manager Dormant" onNavigate={() => navigate('/dashboard')} />
                )}
              </div>
            )}
            
            {activeTab === 'ports' && (
              <div className="animate-in fade-in duration-500 h-full">
                {profile.isConnected ? (
                  <PortManager vpsId={profile.id} />
                ) : (
                  <OfflineState label="Core Connectivity Offline" onNavigate={() => navigate('/dashboard')} />
                )}
              </div>
            )}
            
            {activeTab === 'domains' && (
              <div className="animate-in fade-in duration-500 h-full">
                {profile.isConnected ? (
                  <ProxyManager vpsId={profile.id} />
                ) : (
                  <OfflineState label="Proxy Service Unavailable" onNavigate={() => navigate('/dashboard')} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VpsDetail;
