import React from 'react';
import Skeleton from '../Skeleton';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'red';
  isLoading?: boolean;
  onClick?: () => void;
  active?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, icon, color, isLoading, onClick, active = false }) => {
  const getGradClass = () => {
    switch (color) {
      case 'blue': return 'icon-grad-blue shadow-[0_4px_12px_rgba(59,130,246,0.3)]';
      case 'emerald': return 'icon-grad-emerald shadow-[0_4px_12px_rgba(16,185,129,0.3)]';
      default: return 'icon-grad-rose shadow-[0_4px_12px_rgba(244,63,94,0.3)]';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-[24px] border shadow-sm premium-card transition-all group overflow-hidden relative ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:border-blue-500/30' : ''
      } ${active ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl text-white ${getGradClass()}`}>
          {icon}
        </div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">{sub}</span>
      </div>
      <div>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-0.5">{value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
