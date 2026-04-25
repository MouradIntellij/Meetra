import { useEffect, useRef, useState } from 'react';
import { useSocket }     from './context/SocketContext.jsx';
import { RoomProvider }   from './context/RoomContext.jsx';
import { UIProvider }     from './context/UIContext.jsx';
import { MediaProvider }  from './context/MediaContext.jsx';
import { TranscriptionProvider } from './context/TranscriptionContext.jsx';
import { platform }       from './services/platform/index.js';

import Home        from './pages/Home.jsx';
import Lobby       from './pages/Lobby.jsx';
import WaitingRoom from './pages/WaitingRoom.jsx';
import Room        from './pages/Room.jsx';

function getRouteRoomId() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

function ConnectionBanner() {
  const { connected, connectionError, apiUrl } = useSocket();

  if (connected && !connectionError) return null;

  return (
      <div style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3000,
        width: 'min(760px, calc(100% - 24px))',
        borderRadius: 16,
        border: '1px solid rgba(248,113,113,0.28)',
        background: 'rgba(127,29,29,0.88)',
        color: '#fee2e2',
        padding: '12px 16px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
        backdropFilter: 'blur(16px)',
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Serveur indisponible
        </div>
        <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>
          Connexion impossible vers <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{apiUrl}</span>.
          Le service est temporairement inaccessible. Réessayez dans quelques instants.
        </div>
        {connectionError && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
              Détail: {connectionError}
            </div>
        )}
      </div>
  );
}

export default function App() {
  const urlRoomId = getRouteRoomId();

  const [screen,   setScreen]   = useState(urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState('');
  const [isHost,   setIsHost]   = useState(false);
  const existingStream = useRef(null);

  useEffect(() => {
    document.body.dataset.platform = platform.isElectron ? 'electron' : 'browser';
  }, []);

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
        <>
          <ConnectionBanner />
          <Home
              onJoin={handleJoin}
              prefillRoomId={screen === 'home-join' ? roomId : ''}
          />
        </>
    );
  }

  // ── LOBBY ────────────────────────────
  if (screen === 'lobby') {
    return (
        <>
          <ConnectionBanner />
          <Lobby
              roomId={roomId}
              userName={userName}
              onJoin={handleEnterWaiting}
              onBack={() => {
                setScreen('home');
                window.history.replaceState(null, '', '/');
              }}
          />
        </>
    );
  }

  // ── WAITING ──────────────────────────
  if (screen === 'waiting') {
    return (
        <>
          <ConnectionBanner />
          <WaitingRoom
              roomId={roomId}
              userName={userName}
              isHost={false}
              onJoin={handleEnterRoom}
              onBack={() => setScreen('lobby')}
          />
        </>
    );
  }

  // ── ROOM ─────────────────────────────
  return (
      <>
        <ConnectionBanner />
        <RoomProvider>
          <UIProvider>
            <MediaProvider initialStream={existingStream.current}>
              <TranscriptionProvider roomId={roomId} userName={userName}>
                <Room
                    roomId={roomId}
                    userName={userName}
                    onLeave={handleLeave}
                />
              </TranscriptionProvider>
            </MediaProvider>
          </UIProvider>
        </RoomProvider>
      </>
  );
}
