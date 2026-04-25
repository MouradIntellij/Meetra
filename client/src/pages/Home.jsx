import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function generateFallbackRoomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export default function Home({ onJoin, prefillRoomId = '' }) {
  const [userName, setUserName] = useState('');
  const [roomId,   setRoomId]   = useState(prefillRoomId);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const createRoom = async () => {
    if (!userName.trim()) { setError('Entrez votre nom.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.roomId) {
        throw new Error(data?.error || `ROOM_CREATE_FAILED_${res.status}`);
      }

      onJoin(data.roomId, userName.trim());
    } catch {
      const fallbackRoomId = generateFallbackRoomId();
      onJoin(fallbackRoomId, userName.trim());
    } finally { setLoading(false); }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!userName.trim()) { setError('Entrez votre nom.'); return; }
    if (!roomId.trim())   { setError("Entrez l'ID de la salle."); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_URL}/api/rooms/${roomId.trim()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `ROOM_LOOKUP_FAILED_${res.status}`);
      }

      if (data.exists) {
        onJoin(roomId.trim(), userName.trim());
      } else {
        setError("Cette salle n'existe pas ou a expiré.");
      }
    } catch {
      onJoin(roomId.trim(), userName.trim());
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-purple-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">📹</div>
          <h1 className="text-4xl font-bold text-white mb-1">VideoConf</h1>
          <p className="text-gray-400 text-sm">Conférence vidéo collaborative · Step 7</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">

          {/* Invitation notice */}
          {prefillRoomId && (
            <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="text-blue-300 text-sm font-semibold">Vous avez été invité</p>
                <p className="text-gray-400 text-xs mt-0.5">Entrez votre nom pour rejoindre la réunion</p>
              </div>
            </div>
          )}

          {/* Name input */}
          <div>
            <label className="block text-gray-300 text-xs font-medium mb-1.5">Votre nom</label>
            <input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (prefillRoomId ? joinRoom(e) : null)}
              placeholder="ex: Alice"
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* If invited via link: show room id (read-only) + join button */}
          {prefillRoomId ? (
            <>
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1.5">Salle</label>
                <input
                  value={roomId}
                  readOnly
                  className="w-full bg-gray-800/50 border border-gray-700 text-gray-400 rounded-xl px-4 py-2.5 text-sm font-mono cursor-not-allowed"
                />
              </div>
              <button
                onClick={joinRoom}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {loading ? '⏳ Connexion...' : '🚀 Rejoindre la réunion'}
              </button>
            </>
          ) : (
            /* Normal home: create OR join */
            <>
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {loading ? '⏳...' : '➕ Créer une nouvelle salle'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-xs">ou rejoindre</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              <form onSubmit={joinRoom} className="space-y-3">
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-1.5">ID de la salle</label>
                  <input
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    placeholder="Coller l'ID ici"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  🚪 Rejoindre la salle
                </button>
              </form>
            </>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg px-4 py-2.5">
              ⚠️ {error}
            </div>
          )}
        </div>

        {!prefillRoomId && (
          <div className="flex flex-wrap justify-center gap-2 mt-6 text-xs text-gray-500">
            {['WebRTC P2P','Partage d\'écran','Chat temps réel','Tableau blanc','Enregistrement','Salles de groupes','Contrôles hôte','Réactions'].map(f => (
              <span key={f} className="px-2 py-0.5 bg-gray-800/60 rounded-full">{f}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
