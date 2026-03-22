import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Plus, Trash2, Copy, Check, Server, Loader2,
  ShieldCheck, AlertTriangle, ChevronDown, X, Eye, EyeOff,
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

interface SshKey {
  id: string;
  label: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
}

interface VpsOption {
  id: string;
  name: string;
  host: string;
  isConnected: boolean;
}

const KeyManager: React.FC = () => {
  const { showToast } = useToast();

  /* ── Saved keys ── */
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  /* ── Add key form ── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addPrivateKey, setAddPrivateKey] = useState('');
  const [addPublicKey, setAddPublicKey] = useState('');
  const [showPrivate, setShowPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Install to VPS ── */
  const [vps, setVps] = useState<VpsOption[]>([]);
  const [installKeyId, setInstallKeyId] = useState('');
  const [installVpsId, setInstallVpsId] = useState('');
  const [installing, setInstalling] = useState(false);

  /* ── UI misc ── */
  const [copied, setCopied] = useState<string | null>(null); // keyId
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const { data } = await api.get('/keys');
      setKeys(data.keys);
    } catch {
      showToast('Failed to load SSH keys', 'error');
    } finally {
      setLoadingKeys(false);
    }
  }, [showToast]);

  const fetchVps = useCallback(async () => {
    try {
      const { data } = await api.get('/vps');
      setVps(data.profiles);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchVps();
  }, [fetchKeys, fetchVps]);

  const handleSave = async () => {
    if (!addLabel.trim() || !addPrivateKey.trim()) {
      showToast('Label and Private Key are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/keys', {
        label: addLabel.trim(),
        privateKey: addPrivateKey.trim(),
        publicKey: addPublicKey.trim() || undefined,
      });
      showToast('SSH key saved', 'success');
      setShowAddForm(false);
      setAddLabel('');
      setAddPrivateKey('');
      setAddPublicKey('');
      fetchKeys();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'Failed to save key', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/keys/${id}`);
      showToast('SSH key deleted', 'success');
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'Failed to delete key', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopy = async (key: SshKey) => {
    await navigator.clipboard.writeText(key.publicKey);
    setCopied(key.id);
    setTimeout(() => setCopied(null), 2000);
    showToast('Public key copied', 'success');
  };

  const handleInstall = async () => {
    if (!installKeyId || !installVpsId) return;
    setInstalling(true);
    try {
      await api.post(`/keys/${installKeyId}/install`, { vpsId: installVpsId });
      showToast('Public key installed on VPS', 'success');
      setInstallKeyId('');
      setInstallVpsId('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'Install failed', 'error');
    } finally {
      setInstalling(false);
    }
  };

  const connectedVps = vps.filter(v => v.isConnected);

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="sticky top-0 z-30 px-8 py-8 flex items-center justify-between border-b border-border-light bg-bg-primary/80 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-text-primary mb-1">SSH Key Manager</h1>
          <p className="text-sm text-text-muted font-medium">Save your SSH keys and deploy them to servers</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          <span>{showAddForm ? 'Cancel' : 'Add Key'}</span>
        </button>
      </header>

      <div className="p-8 space-y-8 max-w-3xl">

        {/* Add Key Form */}
        {showAddForm && (
          <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-600/20">
                <KeyRound size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Add New SSH Key</h2>
                <p className="text-xs text-text-muted mt-0.5">Paste your private key — it's stored encrypted. Public key is derived automatically.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Key Label</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={e => setAddLabel(e.target.value)}
                  placeholder="e.g. My MacBook Pro Key"
                  className="w-full bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-text-primary outline-none focus:border-blue-500/50 transition-all text-sm font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Private Key</label>
                  <button
                    type="button"
                    onClick={() => setShowPrivate(v => !v)}
                    className="flex items-center space-x-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPrivate ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showPrivate ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <textarea
                  value={addPrivateKey}
                  onChange={e => setAddPrivateKey(e.target.value)}
                  rows={showPrivate ? 8 : 3}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  className="w-full bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-xs text-red-400 outline-none focus:border-blue-500/50 transition-all font-mono leading-relaxed resize-none"
                  style={{ filter: showPrivate ? 'none' : 'blur(3px)' }}
                />
                {!showPrivate && (
                  <p className="text-xs text-text-muted mt-1">Key is blurred — click Show to edit</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">
                  Public Key <span className="normal-case font-normal">(optional — auto-derived if omitted)</span>
                </label>
                <textarea
                  value={addPublicKey}
                  onChange={e => setAddPublicKey(e.target.value)}
                  rows={2}
                  placeholder="ssh-ed25519 AAAA..."
                  className="w-full bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-xs text-emerald-400 outline-none focus:border-blue-500/50 transition-all font-mono leading-relaxed resize-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <div className="flex items-center space-x-2 text-amber-500/80 flex-1">
                <AlertTriangle size={13} />
                <p className="text-xs font-medium">Private keys are encrypted at rest using AES-256-GCM.</p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !addLabel.trim() || !addPrivateKey.trim()}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span>{saving ? 'Saving...' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Saved Keys List */}
        <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary tracking-tight">Saved Keys</h2>
            <span className="text-xs text-text-muted font-bold px-3 py-1 bg-bg-tertiary rounded-full border border-border-light">
              {keys.length} {keys.length === 1 ? 'key' : 'keys'}
            </span>
          </div>

          {loadingKeys ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 text-text-muted">
              <KeyRound size={32} className="opacity-30" />
              <p className="text-sm font-bold">No SSH keys saved yet</p>
              <p className="text-xs">Click "Add Key" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <div
                  key={key.id}
                  className="flex items-start justify-between p-4 bg-bg-secondary border border-border-light rounded-2xl hover:border-blue-500/20 transition-all group"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="p-2 bg-bg-tertiary rounded-xl border border-border-light mt-0.5 shrink-0">
                      <KeyRound size={14} className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{key.label}</p>
                      <p className="text-xs text-text-muted font-mono mt-0.5">
                        MD5:{key.fingerprint}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 truncate opacity-60">
                        {key.publicKey.length > 60
                          ? key.publicKey.slice(0, 60) + '…'
                          : key.publicKey}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleCopy(key)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-tertiary/70 text-text-muted hover:text-text-primary rounded-xl text-xs font-bold transition-all border border-border-light"
                    >
                      {copied === key.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copied === key.id ? 'Copied' : 'Copy pub'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deleting === key.id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all border border-red-500/20 disabled:opacity-50"
                    >
                      {deleting === key.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Install to VPS */}
        {keys.length > 0 && (
          <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-bg-secondary rounded-2xl border border-border-light">
                <Server size={20} className="text-text-muted" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Deploy Public Key to Server</h2>
                <p className="text-xs text-text-muted mt-0.5">Appends the public key to <code className="font-mono">~/.ssh/authorized_keys</code></p>
              </div>
            </div>

            {connectedVps.length === 0 ? (
              <p className="text-xs text-text-muted py-2">No connected servers. Connect a VPS from the Dashboard first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Select Key</label>
                  <div className="relative">
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <select
                      value={installKeyId}
                      onChange={e => setInstallKeyId(e.target.value)}
                      className="w-full appearance-none bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500/50 transition-all font-bold cursor-pointer"
                    >
                      <option value="">— pick a key —</option>
                      {keys.map(k => (
                        <option key={k.id} value={k.id}>{k.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Select Server</label>
                  <div className="relative">
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <select
                      value={installVpsId}
                      onChange={e => setInstallVpsId(e.target.value)}
                      className="w-full appearance-none bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-xs text-text-primary outline-none focus:border-blue-500/50 transition-all font-bold cursor-pointer"
                    >
                      <option value="">— pick a server —</option>
                      {connectedVps.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.host})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={handleInstall}
                    disabled={installing || !installKeyId || !installVpsId}
                    className="flex items-center space-x-2 px-6 py-3 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 text-text-primary font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-border-light active:scale-95"
                  >
                    {installing ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
                    <span>{installing ? 'Installing...' : 'Install Key'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KeyManager;
