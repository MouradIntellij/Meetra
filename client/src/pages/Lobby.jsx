// client/src/pages/Lobby.jsx
// Modifications par rapport à l'original :
//  1. Reçoit la prop `isHost` depuis _App.jsx
//  2. Émet JOIN_ROOM avec { roomId, userName, isHost }
//  3. Si le serveur répond WAITING_ROOM_STATUS → appelle onJoin(stream, false)
//  4. Si le serveur répond ROOM_JOINED         → appelle onJoin(stream, true)
//  5. Affiche un badge "Vous êtes l'hôte" ou "Vous rejoignez en tant qu'invité"

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { getApiUrl } from '../utils/appConfig.js';
import {
  JOIN_ROOM,
  ROOM_JOINED,
  WAITING_ROOM_STATUS,
  GUEST_DENIED,
} from '../utils/events.js';

// ─── Contraintes média ────────────────────────────────────────────────────────
const MEDIA_CONSTRAINTS = { video: true, audio: true };
const AUTH_STORAGE_KEY = 'meetra-auth-session';
const API_URL = getApiUrl();

function readStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    return parsed.token || '';
  } catch {
    return '';
  }
}

export default function Lobby({ roomId, userName, isHost = false, onJoin, onBack }) {
  const { socket } = useSocket();

  const [micOn,    setMicOn]    = useState(true);
  const [camOn,    setCamOn]    = useState(true);
  const [joining,  setJoining]  = useState(false);
  const [error,    setError]    = useState('');
  const [denied,   setDenied]   = useState(false);
  const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [waitingGuests, setWaitingGuests] = useState([]);
  const [participants, setParticipants] = useState([]);

  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const preserveStreamRef = useRef(false);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const grouped = {
      audioinput: list.filter((device) => device.kind === 'audioinput'),
      videoinput: list.filter((device) => device.kind === 'videoinput'),
      audiooutput: list.filter((device) => device.kind === 'audiooutput'),
    };
    setDevices(grouped);
    setSelectedAudioInput((current) => current || grouped.audioinput[0]?.deviceId || '');
    setSelectedVideoInput((current) => current || grouped.videoinput[0]?.deviceId || '');
    setSelectedAudioOutput((current) => current || grouped.audiooutput[0]?.deviceId || '');
  };

  // ── Démarrer la prévisualisation caméra ───────────────────────────────────
  useEffect(() => {
    let active = true;
    const constraints = {
      audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : MEDIA_CONSTRAINTS.audio,
      video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : MEDIA_CONSTRAINTS.video,
    };

    streamRef.current?.getTracks().forEach((t) => t.stop());

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        stream.getAudioTracks().forEach((t) => { t.enabled = micOn; });
        stream.getVideoTracks().forEach((t) => { t.enabled = camOn; });
        refreshDevices().catch(() => {});
      })
      .catch(() => setError("Caméra ou micro inaccessible. Vérifiez vos permissions."));

    return () => {
      active = false;
      if (!preserveStreamRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedAudioInput, selectedVideoInput]);

  useEffect(() => {
    if (!selectedAudioOutput || !videoRef.current?.setSinkId) return;
    videoRef.current.setSinkId(selectedAudioOutput).catch(() => {});
  }, [selectedAudioOutput]);

  // ── Sync toggle micro ─────────────────────────────────────────────────────
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = micOn; });
  }, [micOn]);

  // ── Sync toggle caméra ────────────────────────────────────────────────────
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = camOn; });
  }, [camOn]);

  useEffect(() => {
    if (!isHost || !roomId) return;
    let active = true;

    const loadRoomState = async () => {
      const token = readStoredAuthToken();
      try {
        const [participantsRes, waitingRes] = await Promise.all([
          fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/participants`),
          token
            ? fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/waiting`, {
                headers: { authorization: `Bearer ${token}` },
              })
            : Promise.resolve(null),
        ]);

        const participantsData = participantsRes.ok ? await participantsRes.json() : {};
        const waitingData = waitingRes?.ok ? await waitingRes.json() : {};
        if (!active) return;
        setParticipants(Array.isArray(participantsData.participants) ? participantsData.participants : []);
        setWaitingGuests(Array.isArray(waitingData.queue) ? waitingData.queue : []);
      } catch {
        // Le lobby reste utilisable même si l'état temps réel n'est pas disponible.
      }
    };

    loadRoomState();
    const intervalId = window.setInterval(loadRoomState, 2000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isHost, roomId]);

  // ── Écouter les réponses du serveur ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Hôte ou guest direct → accès immédiat
    const handleRoomJoined = (payload) => {
      preserveStreamRef.current = true;
      setJoining(false);
      onJoin(streamRef.current, true, payload);
    };

    // Guest mis en salle d'attente
    const handleWaiting = () => {
      preserveStreamRef.current = true;
      setJoining(false);
      onJoin(streamRef.current, false, null);
    };

    // Guest refusé avant même d'entrer (salle verrouillée)
    const handleDenied = ({ reason }) => {
      preserveStreamRef.current = false;
      setJoining(false);
      setDenied(true);
      setError(
        reason === 'room_locked'
          ? 'Cette salle est verrouillée. Contactez lhôte.'
          : reason === 'host_auth_required'
            ? "Votre compte Meetra ne peut pas ouvrir cette réunion comme hôte."
            : reason === 'room_unavailable'
              ? "Cette réunion n'est pas encore disponible. Demandez un lien valide à l'hôte."
          : 'Votre accès a été refusé par lhôte.'
      );
    };

    socket.on(ROOM_JOINED,          handleRoomJoined);
    socket.on(WAITING_ROOM_STATUS,  handleWaiting);
    socket.on(GUEST_DENIED,         handleDenied);

    return () => {
      socket.off(ROOM_JOINED,         handleRoomJoined);
      socket.off(WAITING_ROOM_STATUS, handleWaiting);
      socket.off(GUEST_DENIED,        handleDenied);
    };
  }, [socket, onJoin]);

  // ── Rejoindre ─────────────────────────────────────────────────────────────
  const handleJoin = () => {
    if (!socket || joining) return;
    preserveStreamRef.current = false;
    setJoining(true);
    setError('');

    // Appliquer les préférences audio/vidéo au stream
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = micOn; });
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = camOn; });

    // Émettre JOIN_ROOM avec le flag isHost
    socket.emit(JOIN_ROOM, {
      roomId,
      userName,
      isHost,
      authToken: readStoredAuthToken(),
    });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.5} }
        .lobby-card { animation: fadeUp .35s ease-out; }
      `}</style>

      <div className="lobby-card" style={styles.card}>

        {/* ── En-tête ───────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Prêt à rejoindre ?</h1>
            <p style={styles.sub}>Salle : <span style={{ fontFamily:'monospace', color:'#818cf8', fontWeight:700, letterSpacing:'0.12em' }}>{roomId}</span></p>
          </div>
          {/* Badge hôte / invité */}
          <span style={isHost ? styles.badgeHost : styles.badgeGuest}>
            {isHost ? 'Hôte' : 'Invité'}
          </span>
        </div>

        {/* ── Prévisualisation vidéo ─────────────────────────────────────── */}
        <div style={styles.videoWrap}>
          {camOn
            ? <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
            : (
              <div style={styles.camOff}>
                <div style={styles.avatarLg}>{userName.slice(0, 2).toUpperCase()}</div>
                <p style={{ color:'#475569', fontSize:'13px', marginTop:'12px' }}>Caméra désactivée</p>
              </div>
            )
          }
          {/* Overlay nom */}
          <div style={styles.nameOverlay}>{userName}</div>
        </div>

        {/* ── Contrôles audio/vidéo ─────────────────────────────────────── */}
        <div style={styles.controls}>
          <ToggleBtn
            active={micOn}
            onToggle={() => setMicOn((v) => !v)}
            iconOn={<MicIcon />}
            iconOff={<MicOffIcon />}
            label={micOn ? 'Micro actif' : 'Micro coupé'}
            color="#6366f1"
          />
          <ToggleBtn
            active={camOn}
            onToggle={() => setCamOn((v) => !v)}
            iconOn={<CamIcon />}
            iconOff={<CamOffIcon />}
            label={camOn ? 'Caméra active' : 'Caméra coupée'}
            color="#10b981"
          />
        </div>

        <div style={styles.deviceGrid}>
          <DeviceSelect
            label="Caméra"
            value={selectedVideoInput}
            devices={devices.videoinput}
            onChange={setSelectedVideoInput}
          />
          <DeviceSelect
            label="Micro"
            value={selectedAudioInput}
            devices={devices.audioinput}
            onChange={setSelectedAudioInput}
          />
          {devices.audiooutput.length > 0 && (
            <DeviceSelect
              label="Sortie audio"
              value={selectedAudioOutput}
              devices={devices.audiooutput}
              onChange={setSelectedAudioOutput}
            />
          )}
        </div>

        {isHost && (
          <RoomStatusPreview waitingGuests={waitingGuests} participants={participants} />
        )}

        {/* ── Message d'erreur ─────────────────────────────────────────────── */}
        {error && (
          <div style={styles.errorBox}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Boutons d'action ─────────────────────────────────────────────── */}
        {!denied && (
          <div style={styles.actions}>
            <button onClick={onBack} style={styles.btnBack} disabled={joining}>
              ← Retour
            </button>
            <button onClick={handleJoin} style={styles.btnJoin} disabled={joining || !!error}>
              {joining
                ? <><Spinner /> {isHost ? 'Création…' : 'Connexion…'}</>
                : isHost
                  ? 'Commencer la réunion →'
                  : 'Rejoindre →'
              }
            </button>
          </div>
        )}

        {denied && (
          <button onClick={onBack} style={{ ...styles.btnJoin, background:'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            ← Retourner à l'accueil
          </button>
        )}

        {/* ── Info salle d'attente ─────────────────────────────────────────── */}
        {!isHost && !denied && (
          <p style={styles.hint}>
            L'hôte devra approuver votre admission avant que vous n'entriez dans la salle.
          </p>
        )}
        {isHost && !denied && (
          <p style={styles.hint}>
            Vous pouvez vérifier caméra, micro et personnes en attente avant de commencer.
          </p>
        )}
      </div>
    </div>
  );
}

function DeviceSelect({ label, value, devices, onChange }) {
  return (
    <label style={styles.deviceLabel}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.deviceSelect}>
        {devices.length === 0 ? (
          <option value="">Détection...</option>
        ) : devices.map((device, index) => (
          <option key={device.deviceId || `${device.kind}-${index}`} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoomStatusPreview({ waitingGuests, participants }) {
  return (
    <div style={styles.statusPanel}>
      <div style={styles.statusCol}>
        <div style={styles.statusTitle}>En attente ({waitingGuests.length})</div>
        {waitingGuests.length === 0 ? (
          <div style={styles.emptyState}>Personne en attente.</div>
        ) : waitingGuests.map((guest) => (
          <PersonRow key={guest.socketId} name={guest.userName} sub="Attend votre démarrage" />
        ))}
      </div>
      <div style={styles.statusCol}>
        <div style={styles.statusTitle}>Dans la réunion ({participants.length})</div>
        {participants.length === 0 ? (
          <div style={styles.emptyState}>La réunion n'a pas commencé.</div>
        ) : participants.map((participant) => (
          <PersonRow
            key={participant.socketId}
            name={participant.name}
            sub={participant.isHost ? 'Hôte connecté' : 'Participant connecté'}
          />
        ))}
      </div>
    </div>
  );
}

function PersonRow({ name, sub }) {
  const safeName = name || 'Participant';
  return (
    <div style={styles.personRow}>
      <div style={styles.personAvatar}>{safeName.slice(0, 2).toUpperCase()}</div>
      <div style={{ minWidth: 0 }}>
        <div style={styles.personName}>{safeName}</div>
        <div style={styles.personSub}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Composant bouton toggle ──────────────────────────────────────────────────
function ToggleBtn({ active, onToggle, iconOn, iconOff, label, color }) {
  return (
    <button
      onClick={onToggle}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? `${color}35` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '14px', padding: '14px 20px',
        color: active ? color : '#475569',
        cursor: 'pointer', transition: 'all 0.2s', minWidth: '90px',
        fontFamily: 'inherit',
      }}
    >
      {active ? iconOn : iconOff}
      <span style={{ fontSize: '11px', fontWeight: 600, color: active ? color : '#475569' }}>
        {label}
      </span>
    </button>
  );
}

// ─── Spinner inline ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="28" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Icônes SVG ──────────────────────────────────────────────────────────────
const MicIcon    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const MicOffIcon = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const CamIcon    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const CamOffIcon = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/><line x1="16" y1="11" x2="16" y2="11"/></svg>;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12), transparent 60%), #050810',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    background: 'linear-gradient(160deg,#111827,#0d1322)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px', padding: '32px',
    width: '100%', maxWidth: '480px',
    boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
  },
  title: { margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' },
  sub:   { margin: '4px 0 0', fontSize: '13px', color: '#475569' },
  badgeHost: {
    flexShrink: 0, fontSize: '11px', fontWeight: 700, padding: '5px 10px',
    borderRadius: '100px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
    border: '1px solid rgba(251,191,36,0.25)', whiteSpace: 'nowrap',
  },
  badgeGuest: {
    flexShrink: 0, fontSize: '11px', fontWeight: 700, padding: '5px 10px',
    borderRadius: '100px', background: 'rgba(99,102,241,0.12)', color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.25)', whiteSpace: 'nowrap',
  },
  videoWrap: {
    position: 'relative', borderRadius: '16px', overflow: 'hidden',
    background: '#0d1322', aspectRatio: '16/9',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  camOff: {
    width:'100%', height:'100%', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center', minHeight:'180px',
  },
  avatarLg: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '26px', fontWeight: 900, color: 'white',
  },
  nameOverlay: {
    position: 'absolute', bottom: '10px', left: '12px',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
    borderRadius: '8px', padding: '3px 10px',
    fontSize: '12px', fontWeight: 600, color: 'white',
  },
  controls: { display: 'flex', gap: '12px', justifyContent: 'center' },
  deviceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  deviceLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 700,
  },
  deviceSelect: {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e2e8f0',
    borderRadius: '10px',
    padding: '9px 10px',
    fontSize: '12px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  statusPanel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statusCol: {
    minHeight: '104px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '12px',
  },
  statusTitle: {
    color: '#f1f5f9',
    fontSize: '12px',
    fontWeight: 800,
    marginBottom: '10px',
  },
  emptyState: {
    color: '#475569',
    fontSize: '11px',
    lineHeight: 1.5,
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  personAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '10px',
    fontWeight: 900,
    flexShrink: 0,
  },
  personName: {
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  personSub: {
    color: '#475569',
    fontSize: '10px',
    marginTop: '1px',
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px', padding: '10px 14px',
    fontSize: '13px', color: '#ef4444',
  },
  actions: { display: 'flex', gap: '10px' },
  btnBack: {
    flex: 0, padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
    background: 'transparent', color: '#475569', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
  },
  btnJoin: {
    flex: 1, padding: '12px 20px', borderRadius: '12px', border: 'none',
    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    color: 'white', fontSize: '14px', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  hint: {
    fontSize: '11px', color: '#334155', textAlign: 'center',
    margin: 0, lineHeight: 1.6,
  },
};
