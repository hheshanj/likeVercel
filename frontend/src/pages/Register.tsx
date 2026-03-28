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
      console.log('Registering at:', api.defaults.baseURL + '/auth/register');
      const { data } = await api.post('/auth/register', { name, email, password });
      login(data.accessToken, data.refreshToken, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Registration Error:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.details?.[0]?.message || (err.code === 'ERR_NETWORK' ? 'Network Error: Check your VPN or API URL.' : 'Failed to register account.');
      setError(errorMessage);
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
        <div className="p-4 bg-[#f97386]/5 border border-[#f97386]/10 text-[#f97386] rounded-2xl text-xs font-bold flex items-center space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <ShieldCheck size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[#6475a1] uppercase tracking-[0.2em] ml-1">Full Name</label>
          <div className="relative group blue-border-focus">
            <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6475a1] group-focus-within:text-[#137fec] transition-colors" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0a1836] border border-[#6475a1]/10 rounded-2xl px-12 py-4 text-[#dee5ff] text-sm font-medium outline-none transition-all placeholder:text-[#6475a1]/50"
              placeholder="John Doe"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[#6475a1] uppercase tracking-[0.2em] ml-1">Work Email</label>
          <div className="relative group blue-border-focus">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6475a1] group-focus-within:text-[#137fec] transition-colors" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0a1836] border border-[#6475a1]/10 rounded-2xl px-12 py-4 text-[#dee5ff] text-sm font-medium outline-none transition-all placeholder:text-[#6475a1]/50"
              placeholder="name@company.com"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[#6475a1] uppercase tracking-[0.2em] ml-1">Create Password</label>
          <div className="relative group blue-border-focus">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6475a1] group-focus-within:text-[#137fec] transition-colors" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a1836] border border-[#6475a1]/10 rounded-2xl px-12 py-4 text-[#dee5ff] text-sm font-medium outline-none transition-all placeholder:text-[#6475a1]/50"
              placeholder="••••••••"
              disabled={loading}
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full py-4 bg-[#137fec] hover:bg-[#1d6fee] text-white font-black rounded-2xl shadow-lg shadow-[#137fec]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-3 tracking-[0.1em] uppercase text-xs mt-4"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Initialize Account</span>}
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-sm font-medium text-[#6475a1]">
          Already in the observatory? <Link to="/login" className="text-[#137fec] hover:underline font-bold transition-all ml-1">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
