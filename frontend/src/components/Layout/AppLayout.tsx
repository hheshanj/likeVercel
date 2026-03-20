import React from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, HelpCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-30 flex-shrink-0">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search clusters, nodes, or IPs..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:bg-white focus:border-blue-200 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                <HelpCircle size={20} />
              </button>
              <button className="text-sm font-bold text-slate-500 hover:text-slate-900 px-2">Support</button>
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            
            <button 
              onClick={() => navigate('/vps/add')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all shadow-md shadow-blue-600/10 flex items-center space-x-2"
            >
              <Plus size={14} />
              <span>Add Node</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
