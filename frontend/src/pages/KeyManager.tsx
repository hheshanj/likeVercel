import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Plus, Trash2, Copy, Check, Server, Loader2,
  ShieldCheck, AlertTriangle, ChevronDown, X, Eye, EyeOff,
  Wand2, Download, Clock,
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

interface SshKey {
  id: string;
  label: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface VpsOption {
  id: string;
  name: string;
  host: string;
  isConnected: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse the key algorithm from the public key prefix */
function parseKeyType(publicKey: string): string {
  const prefix = publicKey.trim().split(/\s+/)[0] || '';
  if (prefix === 'ssh-ed25519') return 'Ed25519';
  if (prefix === 'ssh-rsa') return 'RSA';
  if (prefix === 'ecdsa-sha2-nistp256' || prefix === 'ecdsa-sha2-nistp384' || prefix === 'ecdsa-sha2-nistp521') return 'ECDSA';
  if (prefix === 'ssh-dss') return 'DSA';
  return prefix || 'Unknown';
}

function keyTypeBadgeColor(type: string) {
  if (type === 'Ed25519') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (type === 'RSA') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (type === 'ECDSA') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────

const KeyManager: React.FC = () => {
  const { showToast } = useToast();

  /* ── Saved keys ── */
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  /* ── Add key form ── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'paste' | 'generate'>('paste');
  const [addLabel, setAddLabel] = useState('');
  const [addPrivateKey, setAddPrivateKey] = useState('');
  const [addPublicKey, setAddPublicKey] = useState('');
  const [showPrivate, setShowPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  // Returned private key after generation (show once)
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(null);
  const [copiedGenKey, setCopiedGenKey] = useState(false);

  /* ── Install to VPS ── */
  const [vps, setVps] = useState<VpsOption[]>([]);
  const [installKeyId, setInstallKeyId] = useState('');
  const [installVpsIds, setInstallVpsIds] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);

  /* ── UI misc ── */
  const [copied, setCopied] = useState<string | null>(null);
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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchVps();
  }, [fetchKeys, fetchVps]);

  // Reset form when toggled
  const handleToggleForm = () => {
    setShowAddForm(v => !v);
    setAddLabel('');
    setAddPrivateKey('');
    setAddPublicKey('');
    setAddMode('paste');
    setGeneratedPrivateKey(null);
  };

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

  const handleGenerate = async () => {
    if (!addLabel.trim()) {
      showToast('Give this key a label first', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/keys/generate', { label: addLabel.trim() });
      showToast('Ed25519 key pair generated', 'success');
      setGeneratedPrivateKey(data.privateKey);
      setKeys(prev => [data.key, ...prev]);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast(error.response?.data?.error || 'Key generation failed', 'error');
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

  const toggleVpsSelection = (id: string) => {
    setInstallVpsIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleInstall = async () => {
    if (!installKeyId || installVpsIds.length === 0) return;
    setInstalling(true);
    try {
      const results = await Promise.allSettled(
        installVpsIds.map(vpsId => api.post(`/keys/${installKeyId}/install`, { vpsId }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (failed > 0) showToast(`Installed on ${succeeded} server(s), failed on ${failed}`, 'info');
      else showToast(`Public key installed on ${succeeded} server(s)`, 'success');
      // Update lastUsedAt locally
      setKeys(prev => prev.map(k => k.id === installKeyId ? { ...k, lastUsedAt: new Date().toISOString() } : k));
      setInstallKeyId('');
      setInstallVpsIds([]);
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
          onClick={handleToggleForm}
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
              <div className="flex-1">
                <h2 className="text-base font-bold text-text-primary tracking-tight">Add New SSH Key</h2>
                <p className="text-xs text-text-muted mt-0.5">Paste an existing private key or generate a new Ed25519 pair.</p>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex bg-bg-secondary border border-border-light rounded-xl p-1 w-fit">
              <button
                onClick={() => setAddMode('paste')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${addMode === 'paste' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-text-primary'}`}
              >
                Paste Key
              </button>
              <button
                onClick={() => setAddMode('generate')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${addMode === 'generate' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-text-primary'}`}
              >
                <Wand2 size={12} />
                <span>Generate Pair</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Label (shared) */}
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

              {addMode === 'paste' ? (
                <>
                  {/* Private Key */}
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

                  {/* Public Key (optional) */}
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
                </>
              ) : generatedPrivateKey ? (
                /* ── Post-generation: show download prompt ── */
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-2 text-emerald-400">
                    <ShieldCheck size={16} />
                    <p className="text-xs font-bold">Key saved to your vault. Copy the private key below — it won't be shown again.</p>
                  </div>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={generatedPrivateKey}
                      rows={6}
                      className="w-full bg-bg-secondary border border-border-light rounded-xl px-4 py-3 text-xs text-red-400 font-mono leading-relaxed resize-none"
                    />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(generatedPrivateKey);
                        setCopiedGenKey(true);
                        setTimeout(() => setCopiedGenKey(false), 2000);
                      }}
                      className="absolute top-2 right-2 flex items-center space-x-1 px-2 py-1 bg-bg-tertiary rounded-lg text-[10px] font-bold text-text-muted hover:text-text-primary border border-border-light transition-all"
                    >
                      {copiedGenKey ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copiedGenKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([generatedPrivateKey], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${addLabel.replace(/\s+/g, '_')}_id_ed25519`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-bg-secondary border border-border-light rounded-xl text-xs font-bold text-text-muted hover:text-text-primary transition-all"
                  >
                    <Download size={13} />
                    <span>Download Private Key File</span>
                  </button>
                  <button
                    onClick={() => { setGeneratedPrivateKey(null); setShowAddForm(false); setAddLabel(''); }}
                    className="w-full text-center text-xs text-text-muted hover:text-text-primary transition-colors font-bold"
                  >
                    Done →
                  </button>
                </div>
              ) : (
                /* ── Generate mode prompt ── */
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
                  <p className="text-xs text-text-muted">
                    A new <span className="text-blue-400 font-bold">Ed25519</span> key pair will be generated on the server.
                    The private key will be shown <span className="font-bold text-text-primary">once</span> for you to save locally.
                  </p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {!generatedPrivateKey && (
              <div className="flex items-center space-x-3 pt-2">
                <div className="flex items-center space-x-2 text-amber-500/80 flex-1">
                  <AlertTriangle size={13} />
                  <p className="text-xs font-medium">Private keys are encrypted at rest using AES-256-GCM.</p>
                </div>
                {addMode === 'paste' ? (
                  <button
                    onClick={handleSave}
                    disabled={saving || !addLabel.trim() || !addPrivateKey.trim()}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    <span>{saving ? 'Saving...' : 'Save Key'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={saving || !addLabel.trim()}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    <span>{saving ? 'Generating...' : 'Generate Pair'}</span>
                  </button>
                )}
              </div>
            )}
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
              {keys.map(key => {
                const keyType = parseKeyType(key.publicKey);
                const badgeColor = keyTypeBadgeColor(keyType);
                return (
                  <div
                    key={key.id}
                    className="flex items-start justify-between p-4 bg-bg-secondary border border-border-light rounded-2xl hover:border-blue-500/20 transition-all group"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="p-2 bg-bg-tertiary rounded-xl border border-border-light mt-0.5 shrink-0">
                        <KeyRound size={14} className="text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <p className="text-sm font-bold text-text-primary truncate">{key.label}</p>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${badgeColor}`}>
                            {keyType}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-mono mt-0.5">
                          MD5:{key.fingerprint}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <p className="text-xs text-text-muted opacity-60 truncate max-w-[200px]">
                            {key.publicKey.length > 50 ? key.publicKey.slice(0, 50) + '…' : key.publicKey}
                          </p>
                          {key.lastUsedAt ? (
                            <span className="flex items-center space-x-1 text-[10px] text-text-muted shrink-0">
                              <Clock size={10} />
                              <span>Used {relativeTime(key.lastUsedAt)}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted shrink-0 opacity-40">Never deployed</span>
                          )}
                        </div>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Deploy Public Key */}
        {keys.length > 0 && (
          <div className="glass-effect border border-border-light rounded-[32px] p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-bg-secondary rounded-2xl border border-border-light">
                <Server size={20} className="text-text-muted" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Deploy Public Key to Server(s)</h2>
                <p className="text-xs text-text-muted mt-0.5">Appends the public key to <code className="font-mono">~/.ssh/authorized_keys</code></p>
              </div>
            </div>

            {connectedVps.length === 0 ? (
              <p className="text-xs text-text-muted py-2">No connected servers. Connect a VPS from the Dashboard first.</p>
            ) : (
              <div className="space-y-5">
                {/* Key selector */}
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

                {/* Multi-server checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">
                    Select Servers
                    {installVpsIds.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full normal-case font-bold">
                        {installVpsIds.length} selected
                      </span>
                    )}
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {connectedVps.map(v => {
                      const checked = installVpsIds.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            checked
                              ? 'bg-blue-600/10 border-blue-500/30'
                              : 'bg-bg-secondary border-border-light hover:border-blue-500/20'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleVpsSelection(v.id)}
                            className="accent-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate">{v.name}</p>
                            <p className="text-[10px] text-text-muted font-mono">{v.host}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleInstall}
                    disabled={installing || !installKeyId || installVpsIds.length === 0}
                    className="flex items-center space-x-2 px-6 py-3 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 text-text-primary font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-border-light active:scale-95"
                  >
                    {installing ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
                    <span>{installing ? 'Installing...' : `Install to ${installVpsIds.length || '?'} Server${installVpsIds.length !== 1 ? 's' : ''}`}</span>
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
