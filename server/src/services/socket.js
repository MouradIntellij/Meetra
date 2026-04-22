import { io } from 'socket.io-client';

let socket = null;

export const createSocket = (url) => {
    if (socket) return socket; // 🔥 empêche double instance

    socket = io(url, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};