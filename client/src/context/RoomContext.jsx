import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const RoomContext = createContext(null);

export const useRoom = () => {
    const ctx = useContext(RoomContext);
    if (!ctx) throw new Error('useRoom must be inside RoomProvider');
    return ctx;
};

export function RoomProvider({
    children,
    initialRoomId = '',
    initialHostId = '',
    initialCoHostIds = [],
    initialLocked = false,
    initialParticipants = [],
}) {
    const [roomId, setRoomId] = useState(initialRoomId);
    const [hostId, setHostId] = useState(initialHostId);
    const [coHostIds, setCoHostIds] = useState(initialCoHostIds);
    const [locked, setLocked] = useState(initialLocked);
    const [participants, setParticipants] = useState(initialParticipants);
    const [breakoutRooms, setBreakoutRooms] = useState([]);
    const [currentBreakout, setCurrentBreakout] = useState(null);

    // ✅ SCREEN SHARING STATE (AJOUT PROPRE)
    const [screenSharingId, setScreenSharingId] = useState(null);

    const isHost = useCallback(
        (socketId) => socketId === hostId,
        [hostId]
    );

    const isCoHost = useCallback(
        (socketId) => coHostIds.includes(socketId),
        [coHostIds]
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

    useEffect(() => {
        setHostId(initialHostId || '');
    }, [initialHostId]);

    useEffect(() => {
        setCoHostIds(initialCoHostIds || []);
    }, [initialCoHostIds]);

    useEffect(() => {
        setLocked(Boolean(initialLocked));
    }, [initialLocked]);

    useEffect(() => {
        setParticipants(initialParticipants || []);
    }, [initialParticipants]);

    return (
        <RoomContext.Provider
            value={{
                roomId,
                setRoomId,

                hostId,
                setHostId,

                coHostIds,
                setCoHostIds,

                locked,
                setLocked,

                participants,
                setParticipants,

                breakoutRooms,
                setBreakoutRooms,

                currentBreakout,
                setCurrentBreakout,

                isHost,
                isCoHost,
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
