import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export interface SshKey {
  id: string;
  label: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface KeyContextType {
  keys: SshKey[];
  loading: boolean;
  error: string;
  totalKeys: number;
  refreshKeys: () => Promise<void>;
  setKeys: React.Dispatch<React.SetStateAction<SshKey[]>>;
}

const KeyContext = createContext<KeyContextType | undefined>(undefined);

export const KeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshKeys = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/keys');
      setKeys(data.keys);
      setError('');
    } catch (err) {
      console.error('Failed to fetch SSH keys', err);
      setError('Failed to load SSH keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKeys();
  }, [refreshKeys]);

  const totalKeys = keys.length;

  return (
    <KeyContext.Provider value={{ keys, loading, error, totalKeys, refreshKeys, setKeys }}>
      {children}
    </KeyContext.Provider>
  );
};

export const useKeys = () => {
  const context = useContext(KeyContext);
  if (context === undefined) {
    throw new Error('useKeys must be used within a KeyProvider');
  }
  return context;
};
