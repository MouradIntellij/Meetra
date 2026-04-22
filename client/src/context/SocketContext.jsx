import { createContext, useContext, useEffect, useState } from 'react';
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  const API_URL =
      import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    console.log('🧠 SocketProvider init');

    const s = io(API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      console.log('✅ Socket connected');
    };

    const onDisconnect = () => {
      setConnected(false);
      console.log('❌ Socket disconnected');
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    return () => {
      console.log('🧹 SocketContext cleanup');

      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.disconnect();
    };
  }, [API_URL]);

  return (
      <SocketContext.Provider value={{ socket, connected }}>
        {children}
      </SocketContext.Provider>
  );
}