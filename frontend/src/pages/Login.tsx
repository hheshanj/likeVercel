import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Lock, Mail, Loader2, ShieldAlert } from 'lucide-react';
import AuthLayout from '../components/Auth/AuthLayout';

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
    <AuthLayout 
      title="Welcome back" 
      subtitle="Enter your credentials to access your dashboard."
    >
      {error && (
        <div className="p-4 bg-red-500/5 border border-red-500/10 text-red-500 rounded-2xl text-xs font-bold flex items-center space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Work Email</label>
          <div className="relative group blue-border-focus">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-slate-900 text-sm font-medium outline-none transition-all placeholder:text-slate-300"
              placeholder="name@company.com"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label>
            <Link to="#" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors">Forgot?</Link>
          </div>
          <div className="relative group blue-border-focus">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-slate-900 text-sm font-medium outline-none transition-all placeholder:text-slate-300"
              placeholder="••••••••"
              disabled={loading}
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-3 tracking-[0.1em] uppercase text-xs"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Sign In to Platform</span>}
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-sm font-medium text-slate-400">
          New to the observatory? <Link to="/register" className="text-blue-600 hover:underline font-bold transition-all ml-1">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
