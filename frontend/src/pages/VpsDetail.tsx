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
  Zap,
  Server,
  Loader2
} from 'lucide-react';
import api from '../utils/api';
import XtermTerminal from '../components/Terminal/XtermTerminal';
import FileManager from '../components/VPS/FileManager';
import ProcessManager from '../components/VPS/ProcessManager';
import PortManager from '../components/VPS/PortManager';
import ProxyManager from '../components/VPS/ProxyManager';

const VpsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);
  
  // Get tab from URL search param if exists
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') as any;
  const [activeTab, setActiveTab] = useState<'terminal' | 'files' | 'processes' | 'ports' | 'domains'>(
    ['terminal', 'files', 'processes', 'ports', 'domains'].includes(initialTab) ? initialTab : 'terminal'
  );

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
      <div className="px-8 py-6 border-b border-black/30 bg-bg-secondary/20">
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
              <p className="mt-1 text-text-muted font-mono text-xs font-bold tracking-tight">{profile.username}@{profile.host}:{profile.port}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate(`/vps/${id}/edit`)} // Assuming we'll add an edit route
              className="flex items-center space-x-2 px-6 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-bold text-xs rounded-xl border border-black/10 transition-all shadow-sm active:scale-95 group h-[42px]"
            >
              <SettingsIcon size={16} className="text-text-muted group-hover:text-blue-500 transition-colors" />
              <span>Edit Settings</span>
            </button>
            <button 
              onClick={async () => {
                if (pinging) return;
                setPinging(true);
                setPingResult(null);
                try {
                  const start = Date.now();
                  await api.get(`/vps/${id}/status`);
                  const latency = Date.now() - start;
                  setPingResult(`${latency}ms`);
                  setTimeout(() => setPingResult(null), 3000); // Clear after 3s
                } catch (e) {
                  setPingResult('FAIL');
                } finally {
                  setPinging(false);
                }
              }}
              disabled={pinging}
              className={`flex items-center space-x-2 px-6 py-3 ${pingResult === 'FAIL' ? 'bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold text-xs rounded-xl shadow-xl transition-all active:scale-95 shadow-blue-600/20 disabled:opacity-80 w-[140px] h-[42px] justify-center overflow-hidden`}
            >
              {pinging ? (
                <Loader2 size={16} className="animate-spin" />
              ) : pingResult ? (
                <span className="animate-in zoom-in-95 duration-200">{pingResult}</span>
              ) : (
                <>
                  <Zap size={16} fill="white" />
                  <span>Ping</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-8 border-b border-black/10 bg-bg-secondary/10 flex space-x-8">
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
            {activeTab === 'terminal' && (
              <div className="h-full min-h-[450px]">
                {profile.isConnected ? (
                  <div className="h-full rounded-2xl overflow-hidden border border-border-light shadow-2xl bg-black">
                    <XtermTerminal vpsId={profile.id} />
                  </div>
                ) : (
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
                )}
              </div>
            )}
            
            {activeTab === 'files' && (
              <div className="h-full">
                {profile.isConnected ? (
                  <FileManager vpsId={profile.id} />
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted glass-effect rounded-[32px] border border-border-light font-bold text-xs tracking-wide">
                    Storage Access Restricted
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'processes' && (
              <div className="animate-in fade-in duration-500">
                {profile.isConnected ? (
                  <ProcessManager vpsId={profile.id} />
                ) : (
                  <div className="glass-effect rounded-[32px] p-20 text-center text-text-muted border border-border-light font-bold text-xs tracking-wide">
                     Workload manager dormant.
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'ports' && (
              <div className="animate-in fade-in duration-500 h-full">
                {profile.isConnected ? (
                  <PortManager vpsId={profile.id} />
                ) : (
                  <div className="glass-effect rounded-[32px] p-20 text-center text-text-muted border border-border-light font-bold text-xs tracking-wide h-full flex items-center justify-center">
                     Core connectivity offline.
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'domains' && (
              <div className="animate-in fade-in duration-500 h-full">
                {profile.isConnected ? (
                  <ProxyManager vpsId={profile.id} />
                ) : (
                  <div className="glass-effect rounded-[32px] p-20 text-center text-text-muted border border-border-light font-bold text-xs tracking-wide h-full flex items-center justify-center">
                     Proxy service unavailable.
                  </div>
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
