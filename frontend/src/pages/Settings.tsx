import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, LogOut, Trash2, Lock,
  Fingerprint, ChevronDown, ChevronUp, Sun, Moon, Monitor,
  Download, Shield, ClockIcon, Loader2, Check, AlertTriangle,
  ServerIcon, KeyRound, FileUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

/* ─── Types ─────────────────────────────────────────────── */
type Theme = 'dark' | 'light' | 'system';

interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  createdAt: string;
}

/* ─── Helpers ────────────────────────────────────────────── */
function actionIcon(action: string) {
  if (action === 'connect_vps') return <ServerIcon size={12} className="text-blue-400" />;
  if (action === 'key_install') return <KeyRound size={12} className="text-emerald-400" />;
  if (action === 'deploy') return <FileUp size={12} className="text-purple-400" />;
  return <ClockIcon size={12} className="text-text-muted" />;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  localStorage.setItem('theme', theme);
}

/* ─── Component ──────────────────────────────────────────── */
const Settings: React.FC = () => {
  const { user, logout } = useAuth();

  /* Password change */
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* Theme */
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');

  /* Backup */
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* Activity */
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [actLoading, setActLoading] = useState(true);

  /* Misc */
  const [purging, setPurging] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const { data } = await api.get('/auth/activity');
      setActivities(data.logs);
    } catch { /* ignore */ }
    finally { setActLoading(false); }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  /* ── Handlers ── */
  const handleChangeTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ type: 'error', text: 'All fields are required' }); return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' }); return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' }); return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ type: 'success', text: 'Password updated successfully' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setShowPwForm(false); setPwMsg(null); }, 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setPwMsg({ type: 'error', text: e.response?.data?.error || 'Failed to update password' });
    } finally {
      setPwSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data } = await api.get('/auth/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `likeVercel-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to download backup' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('This will OVERWRITE your current database and existing data. The application will need to reload. Continue?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRestoreLoading(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append('backup', file);

    try {
      await api.post('/auth/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFeedback({ type: 'success', message: 'Database restored successfully! Reloading...' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to restore database. Ensure it is a valid SQLite file.'
      });
    } finally {
      setRestoreLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    setPurging(true);
    try {
      setFeedback(null);
      await api.delete('/auth/profile');
      logout();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to purge infrastructure nodes' });
    } finally { setPurging(false); }
  };

  const themeOptions: { value: Theme; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="sticky top-0 z-30 px-8 py-8 border-b border-border-light bg-bg-primary/80 backdrop-blur-xl flex items-end justify-between">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">
            <SettingsIcon size={12} />
            <span>System Preferences</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-text-primary">Account Settings</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-2 px-5 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold text-xs rounded-2xl transition-all active:scale-95"
        >
          <LogOut size={14} />
          <span>Terminate Session</span>
        </button>
      </header>

      <div className="p-8 space-y-8 max-w-3xl">
        {feedback && (
          <div className={`p-4 rounded-2xl text-sm font-bold ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {feedback.message}
          </div>
        )}

        {/* ── Identity Card ── */}
        <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-6 relative overflow-hidden shadow-xl">
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
              <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
            </div>
          </div>

          {/* Change password toggle */}
          <button
            onClick={() => { setShowPwForm(v => !v); setPwMsg(null); }}
            className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all group"
          >
            <div className="flex items-center space-x-3">
              <Lock size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-text-primary">Change Password</span>
            </div>
            {showPwForm ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
          </button>

          {showPwForm && (
            <div className="space-y-4 p-5 bg-bg-secondary border border-border-light rounded-2xl animate-in fade-in duration-200">
              {pwMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${pwMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {pwMsg.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
                  <span>{pwMsg.text}</span>
                </div>
              )}
              <div className="space-y-3">
                {[
                  { label: 'Current Password', value: currentPw, set: setCurrentPw },
                  { label: 'New Password', value: newPw, set: setNewPw },
                  { label: 'Confirm New Password', value: confirmPw, set: setConfirmPw },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">{label}</label>
                    <input
                      type="password"
                      value={value}
                      onChange={e => set(e.target.value)}
                      className="w-full bg-bg-primary border border-border-light rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-blue-500/50 transition-all font-bold"
                      placeholder="••••••••"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleChangePassword}
                  disabled={pwSaving}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
                  <span>{pwSaving ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Appearance ── */}
        <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-bg-secondary border border-border-light rounded-2xl">
              <Sun size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary tracking-tight">Appearance</h2>
              <p className="text-xs text-text-muted">Choose your preferred color scheme</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => handleChangeTheme(value)}
                className={`flex flex-col items-center space-y-2 p-4 rounded-2xl border transition-all ${
                  theme === value
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                    : 'bg-bg-secondary border-border-light text-text-muted hover:border-blue-500/20'
                }`}
              >
                <Icon size={18} className={theme === value ? 'text-blue-400' : 'text-text-muted'} />
                <span className="text-xs font-bold">{label}</span>
                {theme === value && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Security + Data ── */}
        <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-4">
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2.5 bg-bg-secondary border border-border-light rounded-2xl">
              <Shield size={16} className="text-text-muted" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary tracking-tight">Security & Data</h2>
              <p className="text-xs text-text-muted">Token rotation, backups, and account actions</p>
            </div>
          </div>

          <button
            onClick={handleRotateToken}
            className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all group"
          >
            <div className="flex items-center space-x-3">
              <Lock size={14} className="text-text-muted group-hover:text-blue-500 transition-colors" />
              <span className="text-xs font-bold text-text-primary">Rotate Access Token</span>
            </div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Run</span>
          </button>

          <button
            onClick={handleBackup}
            disabled={backupLoading}
            className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all disabled:opacity-60 group"
          >
            <div className="flex items-center space-x-3">
              <Download size={14} className="text-text-muted group-hover:text-blue-500 transition-colors" />
              <div className="text-left">
                <p className="text-xs font-bold text-text-primary">Download Database Backup</p>
                <p className="text-[10px] text-text-muted mt-0.5">Downloads a copy of the local SQLite database</p>
              </div>
            </div>
            {backupLoading ? <Loader2 size={14} className="animate-spin text-text-muted" /> : <Download size={14} className="text-text-muted opacity-40" />}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestore}
            accept=".sqlite,.db"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoreLoading}
            className="w-full flex items-center justify-between p-5 bg-bg-secondary border border-border-light rounded-2xl hover:bg-bg-primary transition-all disabled:opacity-60 group"
          >
            <div className="flex items-center space-x-3">
              <FileUp size={14} className="text-text-muted group-hover:text-amber-500 transition-colors" />
              <div className="text-left">
                <p className="text-xs font-bold text-text-primary">Restore Database Backup</p>
                <p className="text-[10px] text-text-muted mt-0.5">Upload a .sqlite file to replace the current database</p>
              </div>
            </div>
            {restoreLoading ? <Loader2 size={14} className="animate-spin text-text-muted" /> : <FileUp size={14} className="text-text-muted opacity-40" />}
          </button>
        </div>

        {/* ── Activity Log ── */}
        <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-bg-secondary border border-border-light rounded-2xl">
                <ClockIcon size={16} className="text-text-muted" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary tracking-tight">Activity Log</h2>
                <p className="text-xs text-text-muted">Recent actions on your account</p>
              </div>
            </div>
            <button
              onClick={fetchActivity}
              className="text-[10px] font-bold text-text-muted hover:text-text-primary uppercase tracking-widest transition-colors"
            >
              Refresh
            </button>
          </div>

          {actLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 text-text-muted">
              <ClockIcon size={28} className="opacity-20" />
              <p className="text-xs font-bold">No activity yet</p>
              <p className="text-[10px]">Actions like connecting servers and installing keys will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {activities.map(a => (
                <div key={a.id} className="flex items-start space-x-3 p-3 bg-bg-secondary border border-border-light rounded-xl">
                  <div className="p-1.5 bg-bg-tertiary rounded-lg mt-0.5 shrink-0">
                    {actionIcon(a.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary truncate">{a.details}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{relativeTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="glass-effect border border-red-500/10 rounded-[32px] p-8 space-y-4">
          <div className="flex items-center space-x-2 text-red-500/60 mb-1">
            <Trash2 size={14} />
            <h2 className="text-xs font-bold uppercase tracking-widest">Danger Zone</h2>
          </div>
          <button
            onClick={handlePurgeNodes}
            disabled={purging}
            className="w-full p-5 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold rounded-2xl border border-red-500/20 transition-all text-left group disabled:opacity-60 flex items-center justify-between"
          >
            <div>
              Purge Infrastructure Nodes
              <p className="text-[10px] font-medium opacity-60 mt-1">This action decommissions all remote connections permanently.</p>
            </div>
            {purging && <Loader2 size={14} className="animate-spin" />}
          </button>
        </div>

        {/* Spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default Settings;
