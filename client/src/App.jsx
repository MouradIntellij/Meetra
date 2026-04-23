import { useState, useRef } from 'react';
import { RoomProvider }   from './context/RoomContext.jsx';
import { UIProvider }     from './context/UIContext.jsx';
import { MediaProvider }  from './context/MediaContext.jsx';

import Home        from './pages/Home.jsx';
import Lobby       from './pages/Lobby.jsx';
import WaitingRoom from './pages/WaitingRoom.jsx';
import Room        from './pages/Room.jsx';

function getRouteRoomId() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const urlRoomId = getRouteRoomId();

  const [screen,   setScreen]   = useState(urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState('');
  const [isHost,   setIsHost]   = useState(false);
  const existingStream = useRef(null);

  const handleJoin = (rid, uname) => {
    setRoomId(rid);
    setUserName(uname);
    setScreen('lobby');
    window.history.replaceState(null, '', `/room/${rid}`);
  };

  const handleEnterWaiting = async (stream) => {
    existingStream.current = stream || null;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res  = await fetch(`${API_URL}/api/rooms/${roomId}`);
      const data = await res.json();

      const willBeHost = !data.exists || (data.participantCount ?? 0) === 0;

      setIsHost(willBeHost);
      setScreen(willBeHost ? 'room' : 'waiting');
    } catch {
      setIsHost(true);
      setScreen('room');
    }
  };

  const handleEnterRoom = (stream) => {
    existingStream.current = stream || null;
    setScreen('room');
  };

  const handleLeave = () => {
    existingStream.current = null;
    setRoomId('');
    setUserName('');
    setIsHost(false);
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  // ── HOME ─────────────────────────────
  if (screen === 'home' || screen === 'home-join') {
    return (
        <Home
            onJoin={handleJoin}
            prefillRoomId={screen === 'home-join' ? roomId : ''}
        />
    );
  }

  // ── LOBBY ────────────────────────────
  if (screen === 'lobby') {
    return (
        <Lobby
            roomId={roomId}
            userName={userName}
            onJoin={handleEnterWaiting}
            onBack={() => {
              setScreen('home');
              window.history.replaceState(null, '', '/');
            }}
        />
    );
  }

  // ── WAITING ──────────────────────────
  if (screen === 'waiting') {
    return (
        <WaitingRoom
            roomId={roomId}
            userName={userName}
            isHost={false}
            onJoin={handleEnterRoom}
            onBack={() => setScreen('lobby')}
        />
    );
  }

  // ── ROOM ─────────────────────────────
  return (
      <RoomProvider>
        <UIProvider>
          <MediaProvider initialStream={existingStream.current}>
            <Room
                roomId={roomId}
                userName={userName}
                onLeave={handleLeave}
            />
          </MediaProvider>
        </UIProvider>
      </RoomProvider>
  );
}