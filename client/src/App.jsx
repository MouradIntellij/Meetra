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
import WaitingRoomPanel from './components/layout/WaitingRoomPanel.jsx';

function getRouteRoomId() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

function getRouteMeetingLaunch() {
  const params = new URLSearchParams(window.location.search);
  return {
    autoLobby: params.get('meetraLobby') === '1',
    userName: params.get('name') || '',
    asHost: params.get('host') === '1',
  };
}

function buildMeetingWindowUrl(roomId, userName, options = {}) {
  const params = new URLSearchParams();
  params.set('meetraLobby', '1');
  if (userName) params.set('name', userName);
  if (options.asHost) params.set('host', '1');
  return `/room/${encodeURIComponent(roomId)}?${params.toString()}`;
}

function openMeetingWindow(roomId, userName, options = {}) {
  const width = 560;
  const height = 760;
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const popup = window.open(
    buildMeetingWindowUrl(roomId, userName, options),
    `meetra-${roomId}`,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  return popup;
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
          Connexion serveur en cours ou impossible vers <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{apiUrl}</span>.
          Si Render est en veille, patientez quelques secondes puis réessayez.
        </div>
        {connectionError && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
              Détail: {connectionError}
            </div>
        )}
      </div>
  );
}

function InviteOnlyJoin({ roomId, initialName = '', onJoin }) {
  const [name, setName] = useState(initialName);
  const [cancelled, setCancelled] = useState(false);
  const [closed, setClosed] = useState(false);

  const join = () => {
    const safeName = name.trim();
    if (!safeName) return;
    onJoin(roomId, safeName, { asHost: false, sameWindow: true });
  };

  const closeInvitation = () => {
    setCancelled(true);
    window.close();
    window.setTimeout(() => setClosed(true), 160);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(99,102,241,0.13), transparent 70%), #050810',
      color: '#e2e8f0',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        width: 'min(440px, 100%)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(160deg, #111827, #0d1322)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
        padding: 28,
      }}>
        <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Invitation Meetra
        </div>
        <h1 style={{ margin: '10px 0 8px', color: '#fff', fontSize: 26, lineHeight: 1.15 }}>
          Rejoindre la réunion
        </h1>
        <p style={{ margin: '0 0 18px', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
          {closed
            ? "L'invitation est mise de côté. Le lien reste utilisable si vous voulez rejoindre plus tard."
            : "Vous avez reçu un lien d'invitation. Cette page permet uniquement d'entrer dans cette salle."}
        </p>

        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(99,102,241,0.18)',
          background: 'rgba(99,102,241,0.08)',
          padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 700, marginBottom: 6 }}>Salle</div>
          <div style={{ fontFamily: 'monospace', color: '#fff', fontWeight: 800, wordBreak: 'break-all' }}>{roomId}</div>
        </div>

        {!closed && (
          <>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Votre nom d'affichage
            </label>
            <input
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setCancelled(false);
              }}
              onKeyDown={(event) => event.key === 'Enter' && join()}
              placeholder="Ex : Mourad"
              style={{
                width: '100%',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </>
        )}

        {cancelled && !closed && (
          <div style={{
            marginTop: 14,
            borderRadius: 12,
            border: '1px solid rgba(250,204,21,0.2)',
            background: 'rgba(113,63,18,0.22)',
            color: '#fef3c7',
            padding: '10px 12px',
            fontSize: 13,
          }}>
            Entrée annulée. Vous pouvez fermer cet onglet ou rejoindre plus tard avec le même lien.
          </div>
        )}

        {closed && (
          <div style={{
            marginTop: 14,
            borderRadius: 12,
            border: '1px solid rgba(34,197,94,0.18)',
            background: 'rgba(6,78,59,0.24)',
            color: '#bbf7d0',
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            Le navigateur bloque parfois la fermeture automatique. Cette page reste limitée à cette invitation et ne donne pas accès à la création de réunion.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={closed ? () => setClosed(false) : closeInvitation}
            style={{
              flex: closed ? 1 : 0,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#94a3b8',
              borderRadius: 12,
              padding: '12px 16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
            }}
          >
            {closed ? 'Revenir au lien' : 'Fermer'}
          </button>
          {!closed && (
            <button
              type="button"
              onClick={join}
              disabled={!name.trim()}
              style={{
                flex: 1,
                border: 'none',
                background: name.trim() ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,0.06)',
                color: name.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                borderRadius: 12,
                padding: '12px 18px',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontWeight: 800,
              }}
            >
              Demander l'admission
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { socket } = useSocket();
  const urlRoomId = getRouteRoomId();
  const launch = getRouteMeetingLaunch();

  const [screen,   setScreen]   = useState(urlRoomId && launch.autoLobby ? 'lobby' : urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState(launch.userName || '');
  const [isHost,   setIsHost]   = useState(Boolean(launch.asHost));
  const [requestedHostJoin, setRequestedHostJoin] = useState(Boolean(launch.asHost));
  const [roomSession, setRoomSession] = useState({
    hostSocketId: '',
    participants: [],
    locked: false,
    coHostIds: [],
  });
  const existingStream = useRef(null);

  useEffect(() => {
    document.body.dataset.platform = platform.isElectron ? 'electron' : 'browser';
  }, []);

  const handleJoin = (rid, uname, options = {}) => {
    // Only the main Meetra home page opens a compact meeting window.
    // A direct invitation link (/room/:id) must continue in the current window,
    // otherwise the guest gets duplicated and the waiting-room request is lost.
    if (screen === 'home' && !urlRoomId && !options.sameWindow) {
      const popup = openMeetingWindow(rid, uname, options);
      if (popup) {
        popup.focus();
        return;
      }
    }

    const wantsHostAccess = Boolean(options.asHost);
    setRoomId(rid);
    setUserName(uname);
    setRequestedHostJoin(wantsHostAccess);
    setIsHost(wantsHostAccess);
    setScreen('lobby');
    window.history.replaceState(null, '', `/room/${rid}`);
  };

  const handleEnterWaiting = (stream, admitted = false, payload = null) => {
    existingStream.current = stream || null;

    if (!admitted) {
      setIsHost(false);
      setScreen('waiting');
      return;
    }

    const nextParticipants = payload?.participants || [];
    const nextHostSocketId = payload?.hostSocketId || '';
    const nextIsHost = Boolean(payload?.isHost) || Boolean(requestedHostJoin);

    setRoomSession({
      hostSocketId: nextHostSocketId,
      participants: nextParticipants,
      locked: Boolean(payload?.locked),
      coHostIds: payload?.coHostIds || [],
    });
    setIsHost(nextIsHost);
    setScreen('room');
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
    setRequestedHostJoin(false);
    setRoomSession({
      hostSocketId: '',
      participants: [],
      locked: false,
      coHostIds: [],
    });
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  const handleGuestCancel = () => {
    existingStream.current?.getTracks?.().forEach((track) => track.stop());
    existingStream.current = null;
    setUserName('');
    setIsHost(false);
    setRequestedHostJoin(false);
    setRoomSession({
      hostSocketId: '',
      participants: [],
      locked: false,
      coHostIds: [],
    });
    setScreen('home-join');
    window.history.replaceState(null, '', `/room/${roomId}`);
  };

  // ── HOME ─────────────────────────────
  if (screen === 'home-join') {
    return (
      <>
        <ConnectionBanner />
        <InviteOnlyJoin roomId={roomId} initialName={userName} onJoin={handleJoin} />
      </>
    );
  }

  if (screen === 'home') {
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
              isHost={requestedHostJoin || isHost}
              onJoin={handleEnterWaiting}
              onBack={() => {
                if (urlRoomId && !requestedHostJoin) {
                  handleGuestCancel();
                  return;
                }
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
              onAdmitted={(payload) => handleEnterWaiting(existingStream.current, true, payload)}
              onDenied={urlRoomId && !requestedHostJoin ? handleGuestCancel : handleLeave}
          />
        </>
    );
  }

  // ── ROOM ─────────────────────────────
  return (
      <>
        <ConnectionBanner />
        <RoomProvider
            initialRoomId={roomId}
            initialHostId={roomSession.hostSocketId}
            initialParticipants={roomSession.participants.filter((participant) => participant.socketId !== socket?.id)}
            initialLocked={roomSession.locked}
            initialCoHostIds={roomSession.coHostIds}
        >
          <UIProvider>
            <MediaProvider initialStream={existingStream.current}>
              <TranscriptionProvider roomId={roomId} userName={userName}>
                {(requestedHostJoin || isHost) && <WaitingRoomPanel roomId={roomId} />}
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
