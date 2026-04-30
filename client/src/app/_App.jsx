// client/src/App.jsx  (ou _App.jsx selon votre projet)
// Modifications : ajout de l'écran 'waiting' entre lobby et room
// + intégration de WaitingRoomPanel pour l'hôte dans Room

import { useState, useRef } from 'react';
import { SocketProvider }  from './context/SocketContext.jsx';
import { RoomProvider }    from './context/RoomContext.jsx';
import { UIProvider }      from './context/UIContext.jsx';
import { MediaProvider }   from './context/MediaContext.jsx';
import Home             from './pages/Home.jsx';
import Lobby            from './pages/Lobby.jsx';
import Room             from './pages/Room.jsx';
import WaitingRoom      from './pages/WaitingRoom.jsx';
import WaitingRoomPanel from './components/layout/WaitingRoomPanel.jsx';

// ─── Détection d'une URL directe /room/:roomId ───────────────────────────────
function getRouteRoomId() {
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const urlRoomId = getRouteRoomId();

  // Écrans possibles :
  //  'home'      → page d'accueil
  //  'home-join' → accueil avec modal Rejoindre pré-ouverte (URL directe)
  //  'lobby'     → prévisualisation caméra / micro
  //  'waiting'   → salle d'attente (guest attend l'approbation de l'hôte)
  //  'room'      → visioconférence active
  const [screen,   setScreen]   = useState(urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState('');
  const [isHost,   setIsHost]   = useState(false);
  const existingStream = useRef(null);

  // ── Depuis Home : l'utilisateur clique "Nouvelle réunion" ou "Rejoindre" ───
  // onJoin est appelé par Home.jsx avec (roomId, userName)
  // isHostFlag = true uniquement quand l'utilisateur a créé la salle
  const handleJoin = (rid, uname, isHostFlag = false) => {
    setRoomId(rid);
    setUserName(uname);
    setIsHost(isHostFlag);
    setScreen('lobby');
    window.history.replaceState(null, '', `/room/${rid}`);
  };

  // ── Depuis Lobby : prêt à entrer. Le Lobby a déjà émis JOIN_ROOM. ──────────
  // Si le serveur répond ROOM_JOINED  → onEnterRoom(stream, admitted=true)
  // Si le serveur répond WAITING_ROOM_STATUS → onEnterRoom(stream, admitted=false)
  const handleEnterRoom = (stream, admitted = true) => {
    existingStream.current = stream || null;
    if (admitted) {
      setScreen('room');
    } else {
      // Le guest est mis en salle d'attente
      setScreen('waiting');
    }
  };

  // ── Depuis WaitingRoom : l'hôte a admis le guest ───────────────────────────
  const handleAdmitted = () => {
    setScreen('room');
  };

  // ── Depuis WaitingRoom : le guest quitte / est refusé ───────────────────────
  const handleDeniedOrLeave = () => {
    existingStream.current = null;
    setRoomId('');
    setUserName('');
    setIsHost(false);
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  // ── Quitter la room ──────────────────────────────────────────────────────────
  const handleLeave = () => {
    existingStream.current = null;
    setRoomId('');
    setUserName('');
    setIsHost(false);
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  // ── Écran : Accueil ──────────────────────────────────────────────────────────
  if (screen === 'home' || screen === 'home-join') {
    return (
        <Home
            onJoin={(rid, uname, isHostFlag) => handleJoin(rid, uname, isHostFlag)}
            prefillRoomId={screen === 'home-join' ? roomId : ''}
        />
    );
  }

  // ── Écran : Lobby ────────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
        <Lobby
            roomId={roomId}
            userName={userName}
            isHost={isHost}
            onJoin={handleEnterRoom}
            onBack={() => {
              setScreen('home');
              window.history.replaceState(null, '', '/');
            }}
        />
    );
  }

  // ── Écran : Salle d'attente (guest) ─────────────────────────────────────────
  if (screen === 'waiting') {
    return (
        <WaitingRoom
            roomId={roomId}
            userName={userName}
            onAdmitted={handleAdmitted}
            onDenied={handleDeniedOrLeave}
        />
    );
  }

  // ── Écran : Room (visioconférence active) ────────────────────────────────────
  return (
      <SocketProvider>
        <RoomProvider>
          <UIProvider>
            <MediaProvider initialStream={existingStream.current}>

              {/* Panneau salle d'attente visible uniquement pour l'hôte */}
              {isHost && <WaitingRoomPanel roomId={roomId} />}

              <Room
                  roomId={roomId}
                  userName={userName}
                  isHost={isHost}
                  onLeave={handleLeave}
              />

            </MediaProvider>
          </UIProvider>
        </RoomProvider>
      </SocketProvider>
  );
}