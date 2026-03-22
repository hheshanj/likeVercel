import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Terminal, Shield, Trash2, KeyRound, ChevronDown } from 'lucide-react';
import api from '../utils/api';

const EditVps: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: ''
  });

  /* Saved keys */
  const [savedKeys, setSavedKeys] = useState<{ id: string; label: string; fingerprint: string }[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [loadingKey, setLoadingKey] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get(`/vps/${id}`);
        const p = data.profile;
        setFormData({
          name: p.name,
          host: p.host,
          port: p.port,
          username: p.username,
          authType: p.authType,
          password: '', // Password/Keys aren't returned for security
          privateKey: '',
          passphrase: ''
        });
      } catch {
        setError('Failed to load VPS credentials for editing');
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, [id]);

  useEffect(() => {
    api.get('/keys').then(({ data }) => setSavedKeys(data.keys)).catch(() => {});
  }, []);

  const handleSelectKey = async (keyId: string) => {
    setSelectedKeyId(keyId);
    if (!keyId) { setFormData(prev => ({ ...prev, privateKey: '' })); return; }
    setLoadingKey(true);
    try {
      const { data } = await api.post(`/keys/${keyId}/use`);
      setFormData(prev => ({ ...prev, privateKey: data.privateKey }));
    } catch { 
      /* silent */ 
    } finally { 
      setLoadingKey(false); 
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 22 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        authType: formData.authType,
      };

      // Only include credentials if they were typed in
      if (formData.authType === 'password' && formData.password) {
        payload.password = formData.password;
      } else if (formData.authType === 'privateKey' && formData.privateKey) {
        payload.privateKey = formData.privateKey;
        if (formData.passphrase) payload.passphrase = formData.passphrase;
      }

      await api.put(`/vps/${id}`, payload);
      navigate(`/vps/${id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update VPS endpoint');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently decommission node "${formData.name}"?`)) return;
    try {
      await api.delete(`/vps/${id}`);
      navigate('/dashboard');
    } catch {
      setError('Decommission failed');
    }
  };

  if (fetching) return (
    <div className="flex flex-col h-full bg-bg-primary items-center justify-center space-y-4">
       <Loader2 size={40} className="text-blue-500 animate-spin" />
       <span className="text-text-secondary font-bold tracking-widest text-xs uppercase">Pulling Node Config...</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 bg-bg-primary min-h-full">
      <button 
        onClick={() => navigate(`/vps/${id}`)}
        className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors mb-8 group font-bold text-xs uppercase tracking-widest"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold">Return to Node</span>
      </button>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Configure Node</h1>
          <p className="mt-2 text-text-secondary text-sm font-medium">Update access credentials and connection parameters for this cluster.</p>
        </div>
        <button 
           onClick={handleDelete}
           className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20 shadow-sm"
           title="Decommission Node"
        >
           <Trash2 size={22} />
        </button>
      </div>

      <div className="glass-effect rounded-[32px] overflow-hidden p-8 border border-border-light shadow-2xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Terminal size={120} className="text-text-primary" />
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center space-x-3 text-xs font-bold">
             <Shield size={18} className="text-red-500" />
             <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Connection Name</label>
              <input 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-bold" 
                placeholder="e.g. Production Web Server" 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Hostname / IP</label>
              <input 
                name="host"
                value={formData.host}
                onChange={handleChange}
                className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-mono text-sm" 
                placeholder="192.168.1.100" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">SSH Port</label>
              <input 
                name="port"
                type="number"
                value={formData.port}
                onChange={handleChange}
                className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-mono text-sm" 
                required 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">Username</label>
              <input 
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-bold" 
                placeholder="root" 
                required 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-text-muted mb-3 uppercase tracking-widest">Authentication Type</label>
              <div className="grid grid-cols-2 gap-4">
                <label 
                  className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 transition-all ${
                    formData.authType === 'password' 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-xl shadow-blue-500/5' 
                    : 'border-border-light bg-bg-primary text-text-muted hover:border-text-secondary'
                  }`}
                >
                  <input type="radio" name="authType" value="password" checked={formData.authType === 'password'} onChange={handleChange} className="hidden" />
                  <div className={`p-2 rounded-lg ${formData.authType === 'password' ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-muted'}`}>
                    <Save size={18} />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-widest">Password</span>
                </label>
                <label 
                  className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 transition-all ${
                    formData.authType === 'privateKey' 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-xl shadow-blue-500/5' 
                    : 'border-border-light bg-bg-primary text-text-muted hover:border-text-secondary'
                  }`}
                >
                  <input type="radio" name="authType" value="privateKey" checked={formData.authType === 'privateKey'} onChange={handleChange} className="hidden" />
                  <div className={`p-2 rounded-lg ${formData.authType === 'privateKey' ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-muted'}`}>
                    <Shield size={18} />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-widest">SSH Key</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center space-x-3">
              <Shield size={16} />
              <span>Leave password/key blank to keep existing credentials.</span>
            </div>

            {formData.authType === 'password' && (
              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">New SSH Password</label>
                <input 
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-bold" 
                  placeholder="Leave blank to keep current" 
                />
              </div>
            )}

            {formData.authType === 'privateKey' && (
              <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Saved key picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Use Saved Key</label>
                    <Link to="/keys" className="flex items-center space-x-1 text-xs text-blue-500 hover:text-blue-400 font-bold transition-colors">
                      <KeyRound size={11} />
                      <span>Manage Keys</span>
                    </Link>
                  </div>
                  {savedKeys.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No saved keys — <Link to="/keys" className="text-blue-500 hover:underline">add one in Key Manager</Link> or paste below.</p>
                  ) : (
                    <div className="relative">
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      <select
                        value={selectedKeyId}
                        onChange={e => handleSelectKey(e.target.value)}
                        className="w-full appearance-none bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all font-bold text-sm cursor-pointer"
                      >
                        <option value="">— select a saved key or paste below —</option>
                        {savedKeys.map(k => (
                          <option key={k.id} value={k.id}>{k.label} (MD5:{k.fingerprint})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {loadingKey && (
                    <div className="flex items-center space-x-2 mt-2 text-xs text-text-muted">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Loading key...</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">New Private Key Content</label>
                  <textarea 
                    name="privateKey"
                    value={formData.privateKey}
                    onChange={handleChange}
                    className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-mono text-xs leading-relaxed" 
                    rows={6}
                    placeholder="Leave blank to keep current" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-widest">New Key Passphrase (Optional)</label>
                  <input 
                    name="passphrase"
                    type="password"
                    value={formData.passphrase}
                    onChange={handleChange}
                    className="w-full bg-bg-primary/50 border border-border-light focus:border-blue-500 rounded-xl px-4 py-3 text-text-primary outline-none transition-all focus:ring-8 focus:ring-blue-500/5 font-bold" 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-8 border-t border-border-light mt-8">
            <button 
              type="button" 
              onClick={() => navigate(`/vps/${id}`)}
              className="px-6 py-3 text-text-secondary hover:text-text-primary font-bold transition-all hover:bg-bg-tertiary/20 rounded-xl"
            >
              Cancel Changes
            </button>
            <button 
              type="submit" 
              className="flex items-center space-x-2 px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              <span>Sync Node Config</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditVps;
