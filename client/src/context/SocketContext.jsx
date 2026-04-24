import { createContext, useContext, useEffect, useState } from 'react';
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const API_URL =
      import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    console.log('🧠 SocketProvider init');

    const s = io(API_URL, {
      transports: ['websocket'], // 🔥 plus stable
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      setConnectionError('');
      console.log('✅ Socket connected');
    };

    const onDisconnect = () => {
      setConnected(false);
      console.log('❌ Socket disconnected');
    };

    const onConnectError = (error) => {
      setConnected(false);
      setConnectionError(error?.message || 'Serveur indisponible');
      console.warn('⚠️ Socket connect_error', error?.message);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    return () => {
      console.log('🧹 Socket cleanup');

      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.disconnect(); // 🔥 essentiel
    };

    // ❌ PAS DE DEPENDANCE
  }, []);

  return (
      <SocketContext.Provider value={{ socket, connected, connectionError, apiUrl: API_URL }}>
        {children}
      </SocketContext.Provider>
  );
}
