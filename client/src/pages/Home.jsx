import { useState } from 'react';
import { getApiUrl } from '../utils/appConfig.js';
import { CalendarIcon, DoorExitIcon, LinkIcon, VideoAppIcon } from '../components/common/AppIcons.jsx';

const API_URL = getApiUrl();

function generateFallbackRoomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeRoomInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  } catch {
    const match = raw.match(/\/room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  }
}

export default function Home({ onJoin, prefillRoomId = '' }) {
  const [userName, setUserName] = useState('');
  const [roomId,   setRoomId]   = useState(prefillRoomId);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copied, setCopied] = useState(false);

  const createRoomRequest = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.roomId) {
        throw new Error(data?.error || `ROOM_CREATE_FAILED_${res.status}`);
      }

      return {
        roomId: data.roomId,
        joinUrl: data.joinUrl || `${window.location.origin}/room/${data.roomId}`,
      };
    } catch {
      const fallbackRoomId = generateFallbackRoomId();
      return {
        roomId: fallbackRoomId,
        joinUrl: `${window.location.origin}/room/${fallbackRoomId}`,
      };
    }
  };

  const createRoom = async () => {
    if (!userName.trim()) { setError('Entrez votre nom.'); return; }
    setLoading(true); setError('');
    try {
      const meeting = await createRoomRequest();
      setCreatedMeeting(meeting);
      onJoin(meeting.roomId, userName.trim());
    } finally { setLoading(false); }
  };

  const scheduleRoom = async () => {
    setLoading(true); setError('');
    try {
      const meeting = await createRoomRequest();
      setCreatedMeeting(meeting);
    } finally { setLoading(false); }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!userName.trim()) { setError('Entrez votre nom.'); return; }
    const normalizedRoomId = normalizeRoomInput(roomId);
    if (!normalizedRoomId) { setError("Entrez l'ID ou le lien de la salle."); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_URL}/api/rooms/${normalizedRoomId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `ROOM_LOOKUP_FAILED_${res.status}`);
      }

      if (data.exists) {
        onJoin(normalizedRoomId, userName.trim());
      } else {
        setError("Cette salle n'existe pas ou a expiré.");
      }
    } catch {
      onJoin(normalizedRoomId, userName.trim());
    } finally { setLoading(false); }
  };

  const copyCreatedLink = async () => {
    if (!createdMeeting?.joinUrl) return;
    await navigator.clipboard.writeText(createdMeeting.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterCreatedRoom = () => {
    if (!userName.trim()) {
      setError('Entrez votre nom pour entrer comme hôte.');
      return;
    }

    onJoin(createdMeeting.roomId, userName.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-purple-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-emerald-400/10 shadow-[0_28px_60px_rgba(30,64,175,0.28)]">
            <VideoAppIcon size={38} color="#bfdbfe" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">Meetra</h1>
          <p className="text-gray-400 text-sm">Réunion vidéo collaborative · Desktop et Web</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
          {prefillRoomId && (
            <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                <LinkIcon size={19} />
              </div>
              <div>
                <p className="text-blue-300 text-sm font-semibold">Vous avez été invité</p>
                <p className="text-gray-400 text-xs mt-0.5">Entrez votre nom pour rejoindre la réunion</p>
              </div>
            </div>
          )}

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

          {!prefillRoomId && createdMeeting && (
            <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <p className="text-emerald-300 text-sm font-semibold">Réunion créée à l’avance</p>
                  <p className="text-gray-400 text-xs mt-0.5">Partage ce lien, puis entre plus tard comme hôte si tu veux.</p>
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1.5">Lien d’accès</label>
                <input
                  value={createdMeeting.joinUrl}
                  readOnly
                  className="w-full bg-gray-800/60 border border-gray-700 text-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyCreatedLink}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <LinkIcon size={15} />
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
                <button
                  onClick={enterCreatedRoom}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <VideoAppIcon size={16} />
                  Entrer comme hôte
                </button>
              </div>
            </div>
          )}

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
                className="flex w-full items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm"
              >
                <VideoAppIcon size={16} />
                {loading ? 'Connexion...' : 'Rejoindre la réunion'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={createRoom}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <VideoAppIcon size={16} />
                {loading ? 'Création...' : 'Créer et démarrer maintenant'}
              </button>

              <button
                onClick={scheduleRoom}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <LinkIcon size={16} />
                {loading ? 'Préparation...' : 'Créer un lien de réunion'}
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
                  placeholder="Coller l'ID ou le lien ici"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <DoorExitIcon size={16} />
                  Rejoindre la salle
                </button>
              </form>
            </>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg px-4 py-2.5">
              {error}
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
