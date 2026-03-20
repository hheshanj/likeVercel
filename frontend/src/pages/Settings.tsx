import React, { useState } from 'react';
import { 
  User, 
  Settings as SettingsIcon, 
  LogOut, 
  Trash2,
  Lock,
  Mail,
  Fingerprint
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRotateToken = async () => {
    try {
      setFeedback(null);
      const res = await api.post('/auth/refresh', {});
      api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
      setFeedback({ type: 'success', message: 'Access token rotated successfully' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to rotate token' });
    }
  };

  const handlePurgeNodes = async () => {
    if (!window.confirm('This will permanently delete all your VPS profiles and deployments. Continue?')) return;
    try {
      setFeedback(null);
      await api.delete('/auth/profile');
      logout();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to purge infrastructure nodes' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-bold ${
          feedback.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {feedback.message}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-light pb-8">
        <div>
           <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">
             <SettingsIcon size={14} />
             <span>System Preferences</span>
           </div>
           <h1 className="text-4xl font-bold text-text-primary tracking-tighter">Account Settings</h1>
        </div>
        <button 
          onClick={logout}
          className="flex items-center space-x-2 px-6 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold text-xs rounded-xl transition-all active:scale-95"
        >
          <LogOut size={16} />
          <span>Terminate Session</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* User Card */}
        <div className="glass-effect rounded-[32px] p-8 space-y-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Fingerprint size={120} className="text-blue-600" />
          </div>

          <div className="flex items-center space-x-5">
            <div className="h-16 w-16 rounded-[24px] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-2xl shadow-xl">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Authorized Node</p>
              <h3 className="text-2xl font-bold text-text-primary tracking-tight">{user?.name || 'Authorized Operator'}</h3>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center space-x-3 text-text-secondary/70">
              <div className="p-2 bg-bg-primary rounded-lg">
                <Mail size={16} />
              </div>
              <span className="text-xs font-bold">{user?.email || 'unidentified_identity'}</span>
            </div>
            <div className="flex items-center space-x-3 text-text-secondary/70">
              <div className="p-2 bg-bg-primary rounded-lg">
                <Lock size={16} />
              </div>
              <span className="text-xs font-bold">Standard RSA Auth</span>
            </div>
          </div>

          <button 
            disabled
            title="Coming soon"
            className="w-full py-4 bg-bg-primary transition-all text-sm font-bold rounded-2xl border border-border-light opacity-50 cursor-not-allowed"
          >
            Edit Identity Protocol
          </button>
        </div>

        {/* System Settings Area */}
        <div className="space-y-10">
           <section>
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center space-x-2">
                 <User size={14} className="text-blue-500" />
                 <span>Security Node</span>
              </h4>
              <div className="space-y-3">
                 <button 
                  onClick={handleRotateToken}
                  className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all group"
                 >
                    <span className="text-xs font-bold text-text-primary">Rotate Access Token</span>
                    <Lock size={16} className="text-text-muted group-hover:text-blue-500 transition-colors" />
                 </button>
                 <button 
                  onClick={() => setFeedback({ type: 'error', message: 'SSH key management is not yet implemented' })}
                  className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all group"
                 >
                    <span className="text-xs font-bold text-text-primary">Manage Authorized SSH Keys</span>
                    <Fingerprint size={16} className="text-text-muted group-hover:text-blue-500 transition-colors" />
                 </button>
              </div>
           </section>

           <section>
              <h4 className="text-xs font-bold text-red-500/70 uppercase tracking-widest mb-4 flex items-center space-x-2">
                 <Trash2 size={14} />
                 <span>Destruction Sector</span>
              </h4>
              <button 
                onClick={handlePurgeNodes}
                className="w-full p-5 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold rounded-2xl border border-red-500/20 transition-all text-left group"
              >
                 Purge Infrastructure Nodes
                 <p className="text-[10px] font-medium opacity-60 mt-1">This action decommissions all remote connections permanently.</p>
              </button>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
