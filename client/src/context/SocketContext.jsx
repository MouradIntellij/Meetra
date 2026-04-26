import { createContext, useContext, useEffect, useState } from 'react';
import { io } from "socket.io-client";
import { getApiUrl } from '../utils/appConfig.js';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const API_URL = getApiUrl();

  useEffect(() => {
    const s = io(API_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      setConnectionError('');
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = (error) => {
      setConnected(false);
      setConnectionError(error?.message || 'Serveur indisponible');
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.disconnect();
    };

  }, []);

  return (
      <SocketContext.Provider value={{ socket, connected, connectionError, apiUrl: API_URL }}>
        {children}
      </SocketContext.Provider>
  );
}
