import { createContext, ReactNode, useEffect, useMemo } from 'react';
import { RealtimeClient } from '@/services/realtimeClient';

interface RealtimeContextValue {
  client: RealtimeClient;
}

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? 'ws://localhost:8080/ws';

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider = ({ children }: RealtimeProviderProps) => {
  const client = useMemo(() => new RealtimeClient(REALTIME_URL), []);

  useEffect(() => {
    client.connect();

    return () => client.disconnect();
  }, [client]);

  return <RealtimeContext.Provider value={{ client }}>{children}</RealtimeContext.Provider>;
};
