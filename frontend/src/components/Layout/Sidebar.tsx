import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Settings, 
  Layers, 
  LogOut, 
  Zap,
  LayoutDashboard,
  HardDrive
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <aside className="w-64 h-full flex-shrink-0 flex flex-col border-r border-black/30 bg-bg-primary transition-all duration-300 shadow-2xl z-20" id="sidebar">
      {/* Brand Header */}
      <div className="p-8 pb-4 flex items-center space-x-3">
        <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
          <Zap size={24} className="text-white" fill="currentColor" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tighter text-text-primary">VPS Deploy</span>
          <span className="text-xs font-bold text-text-muted tracking-[0.1em] -mt-1 ml-1 uppercase opacity-60">v2.0 Beta</span>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="h-px w-full bg-black/40" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar py-2">
        <p className="px-3 text-xs font-bold text-text-muted uppercase tracking-[0.1em] mb-3 mt-4 opacity-70">System Menu</p>
        
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            isActive 
            ? 'sidebar-active text-blue-500 bg-blue-500/10' 
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary shadow-sm'
          }`}
        >
          <LayoutDashboard className="mr-3 h-4 w-4" />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/endpoints" 
          className={({ isActive }) => `group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            isActive 
            ? 'sidebar-active text-blue-500 bg-blue-500/10' 
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary shadow-sm'
          }`}
        >
          <HardDrive className="mr-3 h-4 w-4" />
          <span>Endpoints</span>
        </NavLink>

        <NavLink 
          to="/apps" 
          className={({ isActive }) => `group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            isActive 
            ? 'sidebar-active text-blue-500 bg-blue-500/10' 
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary shadow-sm'
          }`}
        >
          <Layers className="mr-3 h-4 w-4" />
          <span>Managed Apps</span>
        </NavLink>

        <div className="py-6">
           <p className="px-3 text-xs font-bold text-text-muted uppercase tracking-[0.1em] mb-3 opacity-70">General</p>
           
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
                isActive 
                ? 'sidebar-active text-blue-500 bg-blue-500/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary shadow-sm'
              }`}
            >
              <Settings className="mr-3 h-4 w-4" />
              <span>Settings</span>
            </NavLink>
        </div>
      </nav>

      {/* User Footer Area */}
      <div className="p-6 border-t border-black/20 bg-bg-secondary/20">
        <div className="flex items-center space-x-4 mb-5 group cursor-pointer">
          <div className="relative">
             <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white text-lg shadow-lg group-hover:scale-105 transition-transform">
               {user?.name?.charAt(0).toUpperCase() || 'U'}
             </div>
             <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-bg-primary shadow-emerald-500/50 shadow-lg"></div>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-text-primary truncate">{user?.name || 'Authorized User'}</p>
            <p className="text-[11px] text-text-muted truncate font-bold tracking-tight opacity-70">{user?.email || 'unidentified_identity'}</p>
          </div>
        </div>
        
        <button 
          onClick={logout} 
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-bold text-text-secondary bg-bg-tertiary/40 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all active:scale-95"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
