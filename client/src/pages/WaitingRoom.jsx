/**
 * WaitingRoom.jsx — Salle d'attente Pro
 *
 * Flux complet :
 *   1. Montage  → ouvre la cam locale (preview)
 *   2. Montage  → socket.emit(WAITING_JOIN) pour s'annoncer au serveur
 *   3. Serveur  → WAITING_UPDATE  : liste des gens déjà dans la salle
 *   4. Hôte     → WAITING_ADMITTED : entre dans Room  (socket déclenche onJoin)
 *   5. Hôte     → WAITING_REJECTED : affiche le refus
 *   6. Démontage → WAITING_LEAVE + stop tracks
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { EVENTS }   from '../utils/events.js';

// ─── Icônes ───────────────────────────────────────────────────
const Mic = ({ on, size = 18 }) => on
  ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;

const Cam = ({ on, size = 18 }) => on
  ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
  : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/><path d="M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const Crown = ({ size = 10 }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h20v2H2zM4 17l4-8 4 4 4-8 4 8H4z"/></svg>;

const Back = ({ size = 15 }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;

const Check = ({ size = 15 }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

const X = ({ size = 15 }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ─── Palette avatar déterministe ──────────────────────────────
const PALETTES = [
  ['#1a3a5c','#60a5fa'], ['#1a2e1a','#4ade80'],
  ['#3a1a2e','#f472b6'], ['#2e2a1a','#fbbf24'],
  ['#1a2a3a','#818cf8'], ['#3a1a1a','#f87171'],
];
function avatarStyle(name) {
  const [bg, color] = PALETTES[(name?.charCodeAt(0) ?? 0) % PALETTES.length];
  return { bg, color };
}

// ─── Avatar ───────────────────────────────────────────────────
function Av({ name, size = 36 }) {
  const { bg, color } = avatarStyle(name || '');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
    }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ─── Ligne participant (salle principale) ─────────────────────
function PeerRow({ p, isHost, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ position: 'relative' }}>
        <Av name={p.name} size={32} />
        {isHost && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 13, height: 13, borderRadius: '50%',
            background: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #0d1117',
          }}>
            <Crown size={7} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#e2e8f0',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {p.name}
        </div>
        {isHost && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 1 }}>Hôte</div>}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { on: p.audioEnabled, Icon: Mic  },
          { on: p.videoEnabled, Icon: Cam  },
        ].map(({ on, Icon }, i) => (
          <div key={i} style={{
            width: 24, height: 24, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: on ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
            color:      on ? '#4ade80'                : '#f87171',
          }}>
            <Icon on={on} size={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ligne personne en attente (panneau hôte) ─────────────────
function WaitingRow({ person, onAdmit, onReject }) {
  const [hoverAdmit,  setHoverAdmit]  = useState(false);
  const [hoverReject, setHoverReject] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'rgba(59,130,246,0.07)',
      border: '1px solid rgba(59,130,246,0.2)',
      borderRadius: 10, marginBottom: 6,
      animation: 'slideIn 0.25s ease-out',
    }}>
      <Av name={person.userName} size={30} />

      <span style={{
        flex: 1, fontSize: 13, fontWeight: 600, color: '#e2e8f0',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {person.userName}
      </span>

      {/* Refuser */}
      <button
        onClick={() => onReject(person.socketId)}
        onMouseEnter={() => setHoverReject(true)}
        onMouseLeave={() => setHoverReject(false)}
        style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hoverReject ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.12)',
          color: '#f87171', transition: 'background 0.15s',
        }}
        title="Refuser"
      >
        <X size={13} />
      </button>

      {/* Admettre */}
      <button
        onClick={() => onAdmit(person.socketId)}
        onMouseEnter={() => setHoverAdmit(true)}
        onMouseLeave={() => setHoverAdmit(false)}
        style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hoverAdmit ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.15)',
          color: '#4ade80', transition: 'background 0.15s',
        }}
        title="Admettre"
      >
        <Check size={13} />
      </button>
    </div>
  );
}

// ─── Bouton toggle Mic / Cam ──────────────────────────────────
function ToggleBtn({ on, onToggle, Icon, label }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, padding: '12px 8px', borderRadius: 12,
        border: `1px solid ${on
          ? (hover ? 'rgba(74,222,128,0.45)'  : 'rgba(74,222,128,0.2)')
          : (hover ? 'rgba(248,113,113,0.45)' : 'rgba(248,113,113,0.2)')}`,
        background: on
          ? (hover ? 'rgba(74,222,128,0.18)'  : 'rgba(74,222,128,0.08)')
          : (hover ? 'rgba(248,113,113,0.18)' : 'rgba(248,113,113,0.08)'),
        color:  on ? '#4ade80' : '#f87171',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 5,
        transition: 'all 0.15s',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      <Icon on={on} size={20} />
      <span style={{ fontSize: 11, fontWeight: 600 }}>
        {on ? label : label + ' OFF'}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function WaitingRoom({ roomId, userName, isHost = false, onJoin, onBack }) {
  const { socket } = useSocket();

  // Caméra locale
  const [stream,       setStream]       = useState(null);
  const [audioOn,      setAudioOn]      = useState(true);
  const [videoOn,      setVideoOn]      = useState(true);
  const [mediaError,   setMediaError]   = useState('');

  // Données salle
  const [participants,  setParticipants]  = useState([]);   // dans la salle principale
  const [waitingList,   setWaitingList]   = useState([]);   // en file d'attente (hôte seulement)
  const [hostId,        setHostId]        = useState(null);

  // UI
  const [joining,      setJoining]      = useState(false);
  const [rejected,     setRejected]     = useState('');
  const [admitted,     setAdmitted]     = useState(false);
  const [waitSecs,     setWaitSecs]     = useState(0);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);

  // ── Ouvrir la caméra locale ───────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        setStream(s);
      } catch {
        setMediaError("Caméra/micro inaccessibles. Vérifiez les permissions.");
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Attacher le stream au <video>
  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) { el.srcObject = stream; el.play().catch(() => {}); }
  }, [stream]);

  // Timer d'attente
  useEffect(() => {
    timerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Socket : annoncer présence + écouter événements ──────
  useEffect(() => {
    if (!socket) return;

    // S'annoncer en salle d'attente
    socket.emit(EVENTS.WAITING_JOIN, { roomId, userName });

    // Mise à jour liste (participants dans salle + file d'attente)
    const onWaitingUpdate = ({ participants: peers, waitingList: wl, hostId: hid }) => {
      if (peers !== undefined) setParticipants(peers);
      if (wl    !== undefined) setWaitingList(wl);
      if (hid   !== undefined) setHostId(hid);
    };

    // Quelqu'un entre dans la salle principale → maj liste
    const onUserJoined = (user) => {
      const name = user.name || user.userName || 'Participant';
      setParticipants(prev => {
        if (prev.find(p => p.socketId === user.socketId)) return prev;
        return [...prev, {
          socketId: user.socketId, name,
          audioEnabled: true, videoEnabled: true,
        }];
      });
      if (user.hostId) setHostId(user.hostId);
    };

    // Quelqu'un quitte la salle principale
    const onUserLeft = ({ socketId }) =>
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));

    // Changement d'hôte
    const onHostChanged = ({ newHostId }) => setHostId(newHostId);

    // 🟢 L'hôte nous admet → entrer dans Room
    const onAdmitted = ({ roomId: rid }) => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      setAdmitted(true);
      setTimeout(() => onJoin(null), 400); // légère pause pour l'animation
    };

    // 🔴 L'hôte nous refuse
    const onRejected = ({ message }) => {
      setRejected(message || "L'hôte a refusé votre entrée.");
      setJoining(false);
    };

    socket.on(EVENTS.WAITING_UPDATE,   onWaitingUpdate);
    socket.on(EVENTS.USER_JOINED,      onUserJoined);
    socket.on(EVENTS.USER_LEFT,        onUserLeft);
    socket.on(EVENTS.HOST_CHANGED,     onHostChanged);
    socket.on(EVENTS.WAITING_ADMITTED, onAdmitted);
    socket.on(EVENTS.WAITING_REJECTED, onRejected);

    return () => {
      socket.off(EVENTS.WAITING_UPDATE,   onWaitingUpdate);
      socket.off(EVENTS.USER_JOINED,      onUserJoined);
      socket.off(EVENTS.USER_LEFT,        onUserLeft);
      socket.off(EVENTS.HOST_CHANGED,     onHostChanged);
      socket.off(EVENTS.WAITING_ADMITTED, onAdmitted);
      socket.off(EVENTS.WAITING_REJECTED, onRejected);
      // Quitter proprement la file d'attente
      socket.emit(EVENTS.WAITING_LEAVE, { roomId });
    };
  }, [socket, roomId, userName, onJoin]);

  // ── Toggles micro / cam ───────────────────────────────────
  const toggleAudio = useCallback(() => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setAudioOn(t.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setVideoOn(t.enabled);
  }, []);

  // ── Hôte : admettre / refuser ─────────────────────────────
  const admit = useCallback((targetSocketId) => {
    socket?.emit(EVENTS.WAITING_ADMIT, { roomId, targetSocketId });
  }, [socket, roomId]);

  const reject = useCallback((targetSocketId) => {
    socket?.emit(EVENTS.WAITING_REJECT, { roomId, targetSocketId });
  }, [socket, roomId]);

  const admitAll = useCallback(() => {
    socket?.emit(EVENTS.WAITING_ADMIT_ALL, { roomId });
  }, [socket, roomId]);

  // ── Entrer dans la salle (hôte ou premier arrivant) ───────
  const handleJoin = useCallback(() => {
    if (joining) return;
    setJoining(true);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    onJoin(null);
  }, [joining, onJoin]);

  // ── Retour ────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onBack();
  }, [onBack]);

  // ── Formatage timer ───────────────────────────────────────
  const fmtTime = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${String(sec).padStart(2,'0')}s` : `${sec}s`;
  };

  const isFirst = participants.length === 0;

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* Fond ambiance */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 55% 45% at 15% 55%, rgba(30,58,138,0.18) 0%, transparent 70%),
          radial-gradient(ellipse 45% 35% at 85% 45%, rgba(88,28,135,0.12) 0%, transparent 70%)
        `,
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 920,
        display: 'grid',
        gridTemplateColumns: isHost ? '1fr 290px 260px' : '1fr 290px',
        gap: 14, alignItems: 'start',
      }}>

        {/* ══════════════════════════════════════════════════
            COLONNE 1 — Preview caméra + contrôles
        ══════════════════════════════════════════════════ */}
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, overflow: 'hidden',
          opacity: admitted ? 0 : 1,
          transform: admitted ? 'scale(0.97)' : 'scale(1)',
          transition: 'opacity 0.4s, transform 0.4s',
        }}>

          {/* Header barre */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <button onClick={handleBack} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '5px 11px',
              color: 'rgba(255,255,255,0.5)', fontSize: 12,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              <Back /> Retour
            </button>

            <span style={{
              flex: 1, textAlign: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
            }}>
              Salle d'attente
            </span>

            {/* Timer */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 11, color: 'rgba(255,255,255,0.35)',
              fontFamily: 'monospace',
            }}>
              {fmtTime(waitSecs)}
            </div>
          </div>

          {/* Preview cam */}
          <div style={{
            position: 'relative', aspectRatio: '16/9',
            background: '#080c14', overflow: 'hidden',
          }}>
            <video ref={videoRef} autoPlay playsInline muted style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: (stream && videoOn) ? 1 : 0,
              transition: 'opacity 0.3s',
            }} />

            {(!stream || !videoOn) && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <Av name={userName} size={76} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                  {userName}
                </span>
              </div>
            )}

            {/* Animation "admis" */}
            {admitted && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(74,222,128,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: '#4ade80',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <Check size={32} />
                </div>
              </div>
            )}

            {/* Badges statut (haut-droite) */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end',
            }}>
              {!audioOn && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(239,68,68,0.82)', borderRadius: 6,
                  padding: '3px 8px', fontSize: 11, color: '#fff', fontWeight: 600,
                }}>
                  <Mic on={false} size={11} /> Muet
                </div>
              )}
              {!videoOn && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(239,68,68,0.82)', borderRadius: 6,
                  padding: '3px 8px', fontSize: 11, color: '#fff', fontWeight: 600,
                }}>
                  <Cam on={false} size={11} /> Cam off
                </div>
              )}
            </div>

            {/* Nom bas-gauche */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10,
              background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(6px)',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600,
            }}>
              {userName}{isHost && ' 👑'}
            </div>
          </div>

          {/* Erreur média */}
          {mediaError && (
            <div style={{
              margin: '12px 14px 0',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '9px 13px',
              fontSize: 12, color: '#f87171', lineHeight: 1.5,
            }}>
              ⚠ {mediaError}
            </div>
          )}

          {/* Contrôles micro / cam */}
          <div style={{ display: 'flex', gap: 10, padding: '13px 14px' }}>
            <ToggleBtn on={audioOn} onToggle={toggleAudio} Icon={Mic} label="Micro" />
            <ToggleBtn on={videoOn} onToggle={toggleVideo} Icon={Cam} label="Caméra" />
          </div>

          {/* Indicateur connexion */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '0 14px 14px',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: stream ? '#4ade80' : '#6b7280',
              boxShadow: stream ? '0 0 6px rgba(74,222,128,0.7)' : 'none',
              animation: stream ? 'breathe 2.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
              {stream
                ? `Micro ${audioOn ? 'actif' : 'coupé'} · Cam ${videoOn ? 'active' : 'en pause'}`
                : 'Périphériques non disponibles'}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            COLONNE 2 — Participants + bouton rejoindre
        ══════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Info réunion */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Réunion en cours
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: '#e2e8f0',
              fontFamily: "'DM Mono', monospace", letterSpacing: '-0.01em', marginBottom: 4,
            }}>
              {roomId?.slice(0, 8).toUpperCase()}…
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
              Connecté en tant que{' '}
              <span style={{ color: '#93c5fd', fontWeight: 600 }}>{userName}</span>
            </div>
          </div>

          {/* Liste participants dans la salle */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '14px 14px 6px', flex: 1,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
              }}>
                Dans la salle
              </span>
              <div style={{
                marginLeft: 'auto',
                background: participants.length > 0
                  ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${participants.length > 0
                  ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20, padding: '1px 8px',
                fontSize: 11, fontWeight: 700,
                color: participants.length > 0 ? '#93c5fd' : 'rgba(255,255,255,0.3)',
              }}>
                {participants.length}
              </div>
            </div>

            {participants.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '22px 0',
                color: 'rgba(255,255,255,0.2)', fontSize: 13, lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>🏁</div>
                Vous serez le premier.<br/>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.13)' }}>
                  Démarrez la réunion pour inviter.
                </span>
              </div>
            ) : (
              participants.map((p, i) => (
                <PeerRow
                  key={p.socketId} p={p}
                  isHost={p.socketId === hostId}
                  last={i === participants.length - 1}
                />
              ))
            )}
            <div style={{ height: 8 }} />
          </div>

          {/* Message rejet */}
          {rejected && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 12, color: '#f87171', lineHeight: 1.5,
              animation: 'slideIn 0.25s ease-out',
            }}>
              ⛔ {rejected}
            </div>
          )}

          {/* Bouton principal */}
          <button
            onClick={handleJoin}
            disabled={joining || !!mediaError || admitted}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 14, border: 'none',
              cursor: (joining || mediaError || admitted) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
              background: (joining || mediaError || admitted)
                ? 'rgba(255,255,255,0.06)'
                : isHost || isFirst
                  ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: (joining || mediaError || admitted)
                ? 'rgba(255,255,255,0.3)' : '#fff',
              boxShadow: (joining || mediaError || admitted) ? 'none'
                : (isHost || isFirst)
                  ? '0 6px 22px rgba(245,158,11,0.35)'
                  : '0 6px 22px rgba(59,130,246,0.35)',
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              if (!joining && !mediaError && !admitted)
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; }}
          >
            {admitted  ? '✓ Admis — redirection…'
             : joining ? '⏳ Connexion…'
             : (isHost || isFirst)
               ? '🚀 Démarrer la réunion'
               : `✓ Rejoindre (${participants.length} présent${participants.length > 1 ? 's' : ''})`}
          </button>

          <p style={{
            textAlign: 'center', fontSize: 11, margin: 0,
            color: 'rgba(255,255,255,0.16)', lineHeight: 1.6,
          }}>
            {(isHost || isFirst)
              ? "Vous démarrez en tant qu'hôte. Partagez le lien pour inviter."
              : 'Votre statut micro/cam est préservé à l\'entrée dans la salle.'}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════
            COLONNE 3 (hôte seulement) — File d'attente
        ══════════════════════════════════════════════════ */}
        {isHost && (
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 16, padding: '14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: waitingList.length > 0 ? '#f59e0b' : '#374151',
                boxShadow: waitingList.length > 0
                  ? '0 0 8px rgba(245,158,11,0.7)' : 'none',
                animation: waitingList.length > 0
                  ? 'breathe 1.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
              }}>
                File d'attente
              </span>
              {waitingList.length > 0 && (
                <div style={{
                  marginLeft: 'auto',
                  background: 'rgba(245,158,11,0.2)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 20, padding: '1px 8px',
                  fontSize: 11, fontWeight: 700, color: '#fbbf24',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  {waitingList.length}
                </div>
              )}
            </div>

            {/* Liste d'attente */}
            {waitingList.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '28px 0',
                color: 'rgba(255,255,255,0.18)', fontSize: 12, lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.5 }}>🔔</div>
                Aucun participant<br/>en attente d'admission.
              </div>
            ) : (
              <div>
                {waitingList.map(person => (
                  <WaitingRow
                    key={person.socketId}
                    person={person}
                    onAdmit={admit}
                    onReject={reject}
                  />
                ))}

                {/* Admettre tout */}
                {waitingList.length > 1 && (
                  <button onClick={admitAll} style={{
                    width: '100%', marginTop: 6,
                    padding: '9px', borderRadius: 10,
                    border: '1px solid rgba(74,222,128,0.3)',
                    background: 'rgba(74,222,128,0.1)',
                    color: '#4ade80', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.1)'; }}
                  >
                    ✓ Admettre tout le monde ({waitingList.length})
                  </button>
                )}
              </div>
            )}

            {/* Note hôte */}
            <div style={{
              marginTop: 'auto',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: 10, padding: '9px 12px',
              fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
            }}>
              💡 En tant qu'hôte, vous contrôlez qui entre dans la réunion.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap');
        @keyframes breathe {
          0%,100%{ opacity:1; transform:scale(1); }
          50%    { opacity:0.45; transform:scale(0.82); }
        }
        @keyframes pulse {
          0%,100%{ opacity:1; }
          50%    { opacity:0.5; }
        }
        @keyframes fadeIn {
          from{ opacity:0; } to{ opacity:1; }
        }
        @keyframes popIn {
          0%  { transform:scale(0); }
          70% { transform:scale(1.15); }
          100%{ transform:scale(1); }
        }
        @keyframes slideIn {
          from{ opacity:0; transform:translateY(-6px); }
          to  { opacity:1; transform:translateY(0); }
        }
        * { box-sizing:border-box; }
        @media(max-width:680px){
          div[style*="grid-template-columns"]{
            grid-template-columns:1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
