import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { UserCheck, Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/Auth/AuthLayout';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      login(data.accessToken, data.refreshToken, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      const detailedError = err.response?.data?.details?.[0]?.message;
      setError(detailedError || err.response?.data?.error || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Create Account" 
      subtitle="Join the next generation of cloud operations."
    >
      {error && (
        <div className="p-4 bg-red-500/5 border border-red-500/10 text-red-500 rounded-2xl text-xs font-bold flex items-center space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <ShieldCheck size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
          <div className="relative group blue-border-focus">
            <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-slate-900 text-sm font-medium outline-none transition-all placeholder:text-slate-300"
              placeholder="John Doe"
              disabled={loading}
              required
            />
          </div>
        </div>

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
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Create Password</label>
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
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-3 tracking-[0.1em] uppercase text-xs mt-4"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Initialize Account</span>}
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-sm font-medium text-slate-400">
          Already in the observatory? <Link to="/login" className="text-blue-600 hover:underline font-bold transition-all ml-1">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
