import { useState, useRef } from 'react';
import { SocketProvider } from './context/SocketContext.jsx';
import { RoomProvider }   from './context/RoomContext.jsx';
import { UIProvider }     from './context/UIContext.jsx';
import { MediaProvider }  from './context/MediaContext.jsx';
import Home   from './pages/Home.jsx';
import Lobby  from './pages/Lobby.jsx';
import Room   from './pages/Room.jsx';

function getRouteRoomId() {
  // Support /room/:roomId — works both on localhost and videoconferencepro-client.vercel.app
  const match = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const urlRoomId = getRouteRoomId();

  const [screen,   setScreen]   = useState(urlRoomId ? 'home-join' : 'home');
  const [roomId,   setRoomId]   = useState(urlRoomId || '');
  const [userName, setUserName] = useState('');
  const existingStream = useRef(null);

  const handleJoin = (rid, uname) => {
    setRoomId(rid);
    setUserName(uname);
    setScreen('lobby');
    window.history.replaceState(null, '', `/room/${rid}`);
  };

  const handleEnterRoom = (stream) => {
    existingStream.current = stream || null;
    setScreen('room');
  };

  const handleLeave = () => {
    existingStream.current = null;
    setRoomId('');
    setUserName('');
    setScreen('home');
    window.history.replaceState(null, '', '/');
  };

  if (screen === 'home' || screen === 'home-join') {
    return <Home onJoin={handleJoin} prefillRoomId={screen === 'home-join' ? roomId : ''} />;
  }

  if (screen === 'lobby') {
    return (
        <Lobby
            roomId={roomId}
            userName={userName}
            onJoin={handleEnterRoom}
            onBack={() => {
              setScreen('home');
              window.history.replaceState(null, '', '/');
            }}
        />
    );
  }

  return (
      <SocketProvider>
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
      </SocketProvider>
  );
}
