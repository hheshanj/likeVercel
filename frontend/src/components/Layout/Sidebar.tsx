import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Key, 
  Settings, 
  Plus,
  Box,
  User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Key size={20} />, label: 'SSH Keys', path: '/keys' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col z-40 shrink-0">
      {/* Brand Header */}
      <div className="p-8 pb-6">
        <div className="flex items-center space-x-3 mb-1 cursor-pointer group" onClick={() => navigate('/dashboard')}>
          <div className="p-2 icon-grad-blue rounded-lg text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Box size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 bg-clip-text">likeVercel</span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Infrastructure V2.1</p>
      </div>

      {/* Action Button */}
      <div className="px-6 mb-8">
        <button 
          onClick={() => navigate('/vps/add')}
          className="w-full py-3 icon-grad-blue hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center space-x-2 border border-blue-400/20"
        >
          <Plus size={16} />
          <span>New Instance</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
                isActive 
                ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50 shadow-blue-500/5' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Support & Profile */}
      <div className="p-4 mt-auto border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
            <User size={18} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-400 font-medium">Admin Access</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
