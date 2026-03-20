import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cpu, MemoryStick, Activity } from 'lucide-react';
import api from '../../utils/api';

interface ResourceChartProps {
  vpsId: string;
  isConnected: boolean;
}

const POLL_MS = 3000;

const ResourceChart: React.FC<ResourceChartProps> = ({ vpsId, isConnected }) => {
  const [latest, setLatest] = useState<{ cpu: number; ram: number } | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/vps/${vpsId}/usage`);
      setLatest({ cpu: d.cpu, ram: d.ram });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Usage unavailable');
    }
  }, [vpsId]);

  useEffect(() => {
    if (!isConnected) { setLatest(null); return; }
    fetchUsage();
    intervalRef.current = setInterval(fetchUsage, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isConnected, fetchUsage]);

  if (!isConnected) return null;

  if (error) return (
    <div className="text-xs text-text-muted text-center py-4 opacity-60">{error}</div>
  );

  return (
    <div className="flex items-center gap-8">
      {/* Stat pills */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/10">
          <Cpu size={16} className="text-blue-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-0.5">CPU Usage</p>
          <div className="flex items-baseline space-x-1">
            <p className="text-xl font-black text-text-primary tracking-tighter">
              {latest ? `${latest.cpu}%` : '--%'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/10">
          <MemoryStick size={16} className="text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-0.5">RAM Usage</p>
          <div className="flex items-baseline space-x-1">
            <p className="text-xl font-black text-text-primary tracking-tighter">
              {latest ? `${latest.ram}%` : '--%'}
            </p>
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center space-x-2 px-3 py-1.5 bg-blue-500/5 rounded-full border border-blue-500/10">
        <Activity size={12} className="text-blue-500 animate-pulse" />
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Live telemetry</span>
      </div>
    </div>
  );
};

export default ResourceChart;
