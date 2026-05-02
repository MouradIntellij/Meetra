// client/src/components/layout/WaitingRoom.jsx
// Écran affiché au GUEST pendant qu'il attend l'approbation de l'hôte.
// Props : roomId, userName, onAdmitted(stream), onDenied()
// Ce composant écoute les événements GUEST_ADMITTED et GUEST_DENIED via le socket.

import { useRef, useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext.jsx'; // src/pages/ → ../
import {
  GUEST_ADMITTED,
  GUEST_DENIED,
  ROOM_JOINED,
} from '../utils/events.js'; // src/pages/ → ../

export default function WaitingRoom({ roomId, userName, onAdmitted, onDenied }) {
  const { socket } = useSocket();
  const [dots, setDots] = useState('');
  const [denied, setDenied] = useState(false);
  const [deniedReason, setDeniedReason] = useState('');
  const admissionPayloadRef = useRef(null);
  const admittedRef = useRef(false);

  // Animation "..." sur le texte d'attente
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 600);
    return () => clearInterval(t);
  }, []);

  // Écouter les événements du serveur
  useEffect(() => {
    if (!socket) return;

    const admitOnce = (payload = null) => {
      if (admittedRef.current) return;
      admittedRef.current = true;
      onAdmitted(payload || admissionPayloadRef.current);
    };

    const handleRoomJoined = (payload) => {
      if (payload?.roomId !== roomId) return;
      admissionPayloadRef.current = payload;
      admitOnce(payload);
    };

    const handleAdmitted = () => {
      admitOnce();
    };

    const handleDenied = ({ reason }) => {
      setDenied(true);
      setDeniedReason(reason === 'room_locked' ? 'La salle est verrouillée.' : "L'hôte a refusé votre demande.");
    };

    socket.on(ROOM_JOINED, handleRoomJoined);
    socket.on(GUEST_ADMITTED, handleAdmitted);
    socket.on(GUEST_DENIED,   handleDenied);

    return () => {
      socket.off(ROOM_JOINED, handleRoomJoined);
      socket.off(GUEST_ADMITTED, handleAdmitted);
      socket.off(GUEST_DENIED,   handleDenied);
    };
  }, [socket, roomId, onAdmitted, onDenied]);

  // ── Vue refus ───────────────────────────────────────────────────────────────
  if (denied) {
    return (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={{ ...styles.iconCircle, background: 'rgba(239,68,68,0.12)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={styles.title}>Accès refusé</h2>
            <p style={styles.sub}>{deniedReason}</p>
            <button style={styles.btnDanger} onClick={onDenied}>
              Retourner à l'accueil
            </button>
          </div>
        </div>
    );
  }

  // ── Vue attente ─────────────────────────────────────────────────────────────
  return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          {/* Avatar utilisateur */}
          <div style={styles.avatar}>
            {userName.slice(0, 2).toUpperCase()}
          </div>

          {/* Spinner */}
          <div style={styles.spinnerWrap}>
            <SpinnerRing />
          </div>

          <h2 style={styles.title}>Salle d'attente</h2>
          <p style={styles.sub}>
            Bonjour <strong style={{ color: '#fff' }}>{userName}</strong>, votre demande d'accès a été envoyée à l'hôte{dots}
          </p>
          <p style={styles.hint}>
            Vous serez admis automatiquement lorsque l'hôte approuvera votre demande.
          </p>

          {/* Info salle */}
          <div style={styles.roomBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ color: '#818cf8', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em' }}>
            {roomId}
          </span>
          </div>

          <button style={styles.btnGhost} onClick={onDenied}>
            Annuler et quitter
          </button>
        </div>

        <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      </div>
  );
}

// Spinner animé
function SpinnerRing() {
  return (
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ animation: 'spin 1.2s linear infinite' }}>
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" stroke="#6366f1" strokeWidth="4"
                strokeDasharray="138" strokeDashoffset="100" strokeLinecap="round" />
      </svg>
  );
}

// ── Styles inline (pas de dépendance Tailwind nécessaire) ────────────────────
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 70%), #050810',
    zIndex: 100,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    background: 'linear-gradient(160deg, #111827, #0d1322)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '48px 40px',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
    animation: 'fadeUp 0.4s ease-out',
    textAlign: 'center',
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 900,
    color: 'white',
    marginBottom: '4px',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  spinnerWrap: {
    marginTop: '-8px',
    marginBottom: '-4px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#f1f5f9',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  sub: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  hint: {
    fontSize: '12px',
    color: '#334155',
    margin: 0,
    lineHeight: 1.6,
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '10px',
    padding: '8px 16px',
    marginTop: '4px',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '10px 20px',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '8px',
    fontFamily: 'inherit',
  },
  btnDanger: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '8px',
    fontFamily: 'inherit',
  },
};
