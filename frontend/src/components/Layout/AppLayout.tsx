import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden w-full relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header Toggle */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-6 shrink-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 lg:hidden"
          >
            <Menu size={24} />
          </button>
          <span className="ml-2 text-xl font-black tracking-tighter text-slate-900">likeVercel</span>
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
