import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Server, Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.accessToken, data.refreshToken, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-500/[0.04] blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.04] blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="p-4 bg-blue-600 rounded-[28px] shadow-2xl shadow-blue-600/20 mb-6 transition-all hover:scale-105 duration-500">
            <Server size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tighter">
             VPS Deploy
          </h2>
          <p className="mt-2 text-text-muted font-bold tracking-[0.1em] uppercase text-[10px] opacity-60">Login to your account</p>
        </div>

        <div className="glass-effect p-10 rounded-[40px] border border-black/10 shadow-2xl relative">
          <div className="mb-10 text-left">
            <h3 className="text-2xl font-bold text-text-primary tracking-tight mb-1.5">Welcome back</h3>
            <p className="text-text-secondary text-xs font-medium opacity-80">Please enter your details to continue.</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/5 border border-red-500/10 text-red-600 rounded-2xl text-[11px] font-bold flex items-center space-x-3 animate-in slide-in-from-top-2 duration-300">
              <ShieldCheck size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-2.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.1em] ml-1">Email Address</label>
              <div className="relative group">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-primary/50 border border-black/10 focus:border-blue-500/50 rounded-2xl px-12 py-3.5 text-text-primary text-xs font-bold outline-none transition-all focus:ring-8 focus:ring-blue-500/[0.04]"
                  placeholder="email@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.1em] ml-1">Password</label>
              <div className="relative group">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-primary/50 border border-black/10 focus:border-blue-500/50 rounded-2xl px-12 py-3.5 text-text-primary text-xs font-bold outline-none transition-all focus:ring-8 focus:ring-blue-500/[0.04]"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-2xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-3 tracking-widest uppercase text-[11px]"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Sign In</span>}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-black/5 text-center">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Don't have an account? <Link to="/register" className="text-blue-600 hover:text-blue-700 transition-colors ml-1 font-black">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
