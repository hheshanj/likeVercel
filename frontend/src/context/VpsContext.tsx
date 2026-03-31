import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export interface VPSProfile {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
  authType: string;
  isConnected: boolean;
  region?: string;
}

interface VpsContextType {
  profiles: VPSProfile[];
  loading: boolean;
  error: string;
  offlineCount: number;
  refreshProfiles: () => Promise<void>;
  setProfiles: React.Dispatch<React.SetStateAction<VPSProfile[]>>;
}

const VpsContext = createContext<VpsContextType | undefined>(undefined);

export const VpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<VPSProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshProfiles = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/vps');
      setProfiles(data.profiles);
      setError('');
    } catch (err) {
      console.error('Failed to fetch VPS profiles', err);
      setError('Failed to load infrastructure nodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
    const interval = setInterval(refreshProfiles, 60000); // Heartbeat every 60s
    return () => clearInterval(interval);
  }, [refreshProfiles]);

  const offlineCount = profiles.filter(p => !p.isConnected).length;

  return (
    <VpsContext.Provider value={{ profiles, loading, error, offlineCount, refreshProfiles, setProfiles }}>
      {children}
    </VpsContext.Provider>
  );
};

export const useVps = () => {
  const context = useContext(VpsContext);
  if (context === undefined) {
    throw new Error('useVps must be used within a VpsProvider');
  }
  return context;
};
