import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const RoomContext = createContext(null);

export const useRoom = () => {
    const ctx = useContext(RoomContext);
    if (!ctx) throw new Error('useRoom must be inside RoomProvider');
    return ctx;
};

export function RoomProvider({ children, initialRoomId = '' }) {
    const [roomId, setRoomId] = useState(initialRoomId);
    const [hostId, setHostId] = useState('');
    const [locked, setLocked] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [breakoutRooms, setBreakoutRooms] = useState([]);
    const [currentBreakout, setCurrentBreakout] = useState(null);

    // ✅ SCREEN SHARING STATE (AJOUT PROPRE)
    const [screenSharingId, setScreenSharingId] = useState(null);

    const isHost = useCallback(
        (socketId) => socketId === hostId,
        [hostId]
    );

    const updateParticipant = useCallback((socketId, updates) => {
        setParticipants(prev =>
            prev.map(p =>
                p.socketId === socketId ? { ...p, ...updates } : p
            )
        );
    }, []);

    const addParticipant = useCallback((participant) => {
        setParticipants(prev => {
            if (prev.find(p => p.socketId === participant.socketId)) return prev;
            return [...prev, participant];
        });
    }, []);

    const removeParticipant = useCallback((socketId) => {
        setParticipants(prev => prev.filter(p => p.socketId !== socketId));
    }, []);

    useEffect(() => {
        setRoomId(initialRoomId || '');
    }, [initialRoomId]);

    return (
        <RoomContext.Provider
            value={{
                roomId,
                setRoomId,

                hostId,
                setHostId,

                locked,
                setLocked,

                participants,
                setParticipants,

                breakoutRooms,
                setBreakoutRooms,

                currentBreakout,
                setCurrentBreakout,

                isHost,
                updateParticipant,
                addParticipant,
                removeParticipant,

                // ✅ EXPORT SCREEN SHARING
                screenSharingId,
                setScreenSharingId,
            }}
        >
            {children}
        </RoomContext.Provider>
    );
}
