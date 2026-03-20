import React from 'react';
import Sidebar from './Sidebar';
import TopProgressBar from '../TopProgressBar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden w-full">
      <TopProgressBar />
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
