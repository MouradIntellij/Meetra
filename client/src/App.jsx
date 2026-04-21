import { useState, useRef } from 'react';
import { RoomProvider }   from './context/RoomContext.jsx';
import { UIProvider }     from './context/UIContext.jsx';
import { MediaProvider }  from './context/MediaContext.jsx';

import Home        from './pages/Home.jsx';
import Lobby       from './pages/Lobby.jsx';
import WaitingRoom from './pages/WaitingRoom.jsx';
import Room        from './pages/Room.jsx';

// ── Lire roomId depuis URL (/room/:id) ─────────────────────
function getRouteRoomId() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const urlRoomId = getRouteRoomId();

  // ── Router state ─────────────────────────────────────────
  const [screen,   setScreen]   = useState(urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState('');
  const [isHost,   setIsHost]   = useState(false);

  const existingStream = useRef(null);

  // ── Home → Lobby ─────────────────────────────────────────
  const handleJoin = (rid, uname) => {
    setRoomId(rid);
    setUserName(uname);
    setScreen('lobby');
    window.history.replaceState(null, '', `/room/${rid}`);
  };

  // ── Lobby → WaitingRoom ──────────────────────────────────
  const handleEnterWaiting = async (stream) => {
    existingStream.current = stream || null;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res  = await fetch(`${API_URL}/api/rooms/${roomId}`);
      const data = await res.json();

      const willBeHost =
          !data.exists || (data.participantCount ?? 0) === 0;

      setIsHost(willBeHost);
    } catch {
      setIsHost(false);
    }

    setScreen('waiting');
  };

  // ── WaitingRoom → Room ───────────────────────────────────
  const handleEnterRoom = (stream) => {
    existingStream.current = stream || null;
    setScreen('room');
  };

  // ── Retour waiting → lobby ───────────────────────────────
  const handleWaitingBack = () => {
    setScreen('lobby');
  };

  // ── Quitter room → home ──────────────────────────────────
  const handleLeave = () => {
    existingStream.current = null;
    setRoomId('');
    setUserName('');
    setIsHost(false);
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  // ───────────────── ROUTING ───────────────────────────────

  // Home
  if (screen === 'home' || screen === 'home-join') {
    return (
        <Home
            onJoin={handleJoin}
            prefillRoomId={screen === 'home-join' ? roomId : ''}
        />
    );
  }

  // Lobby (⚠️ maintenant OK. Car SocketProvider est global)
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

  // Waiting Room (style Zoom)
  if (screen === 'waiting') {
    return (
        <WaitingRoom
            roomId={roomId}
            userName={userName}
            isHost={isHost}
            onJoin={handleEnterRoom}
            onBack={handleWaitingBack}
        />
    );
  }

  // Room principale
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