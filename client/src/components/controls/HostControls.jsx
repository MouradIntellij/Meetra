import { useState, useEffect, useRef } from 'react';
import { useSocket }  from '../../context/SocketContext.jsx';
import { useRoom }    from '../../context/RoomContext.jsx';
import { useUI }      from '../../context/UIContext.jsx';
import { EVENTS }     from '../../utils/events.js';
import { platform }   from '../../services/platform/index.js';
import { CrownIcon, MuteGroupIcon, ShieldLockIcon, ShieldOpenIcon, SparkIcon } from '../common/AppIcons.jsx';

// ─── Icônes ───────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ─── Avatar minuscule ─────────────────────────────────────────
const PALETTES = [
  ['#1a3a5c','#60a5fa'],['#1a2e1a','#4ade80'],
  ['#3a1a2e','#f472b6'],['#2e2a1a','#fbbf24'],
];
function MiniAv({ name }) {
  const [bg, color] = PALETTES[(name?.charCodeAt(0) ?? 0) % PALETTES.length];
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: bg, color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
    }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ─── Ligne file d'attente ─────────────────────────────────────
function WaitingEntry({ person, onAdmit, onReject }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 8px', borderRadius: 8,
      background: 'rgba(59,130,246,0.08)',
      border: '1px solid rgba(59,130,246,0.18)',
      marginBottom: 5,
      animation: 'slideDown 0.2s ease-out',
    }}>
      <MiniAv name={person.userName} />
      <span style={{
        flex: 1, fontSize: 12, fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {person.userName}
      </span>
      {/* Refuser */}
      <button onClick={() => onReject(person.socketId)} style={{
        width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: 'rgba(239,68,68,0.15)', color: '#f87171',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
        title="Refuser"
      >
        <XIcon />
      </button>
      {/* Admettre */}
      <button onClick={() => onAdmit(person.socketId)} style={{
        width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: 'rgba(74,222,128,0.15)', color: '#4ade80',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.15)'}
        title="Admettre"
      >
        <CheckIcon />
      </button>
    </div>
  );
}

// ─── HostControls principal ───────────────────────────────────
export default function HostControls({ roomId }) {
  const { socket }              = useSocket();
  const { hostId, locked, coHostIds }      = useRoom();
  const { breakoutOpen, setBreakoutOpen } = useUI();

  const [showPanel,    setShowPanel]    = useState(false);
  const [waitingList,  setWaitingList]  = useState([]);  // ← file d'attente en temps réel
  const previousWaitingCount = useRef(0);
  const iAmHost = socket?.id === hostId;
  const iAmCoHost = coHostIds.includes(socket?.id);

  // ── Écouter les mises à jour de la file d'attente ─────────
  useEffect(() => {
    if (!socket) return;
    const handler = ({ waitingList: wl }) => {
      if (wl !== undefined) setWaitingList(wl);
    };
    socket.on(EVENTS.WAITING_UPDATE, handler);
    return () => socket.off(EVENTS.WAITING_UPDATE, handler);
  }, [socket]);

  useEffect(() => {
    if (!iAmHost && !iAmCoHost) return;

    const previous = previousWaitingCount.current;
    const current = waitingList.length;

    if (current > previous) {
      const latestPerson = waitingList[current - 1];
      setShowPanel(true);
      platform.notify({
        title: 'Participant en attente',
        body: latestPerson?.userName
          ? `${latestPerson.userName} demande l'accès à la réunion`
          : 'Un participant demande l\'accès à la réunion',
      }).catch(() => {});
    }

    previousWaitingCount.current = current;
  }, [waitingList, iAmHost, iAmCoHost]);

  // Pas modérateur → rien à afficher
  if (!iAmHost && !iAmCoHost) return null;

  // ── Actions hôte ──────────────────────────────────────────
  const muteAll    = () => socket.emit(EVENTS.MUTE_ALL,    { roomId });
  const toggleLock = () => socket.emit(EVENTS.LOCK_ROOM,   { roomId, locked: !locked });
  const admit      = (targetSocketId) =>
    socket.emit(EVENTS.WAITING_ADMIT, { roomId, targetSocketId });
  const reject     = (targetSocketId) =>
    socket.emit(EVENTS.WAITING_REJECT, { roomId, targetSocketId });
  const admitAll   = () =>
    socket.emit(EVENTS.WAITING_ADMIT_ALL, { roomId });

  const hasPending = waitingList.length > 0;
  const spotlightPending = waitingList[0] || null;

  return (
    <div style={{ position: 'relative' }}>
      {spotlightPending && (
        <div style={{
          position: 'fixed',
          top: 74,
          right: 16,
          zIndex: 70,
          width: 320,
          borderRadius: 16,
          border: '1px solid rgba(245,158,11,0.3)',
          background: 'linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(15,23,42,0.98) 100%)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          padding: 14,
          backdropFilter: 'blur(14px)',
          animation: 'slideDown 0.2s ease-out',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#fbbf24',
            marginBottom: 8,
          }}>
            Demande d’accès
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MiniAv name={spotlightPending.userName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {spotlightPending.userName}
              </div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                attend votre admission dans la réunion
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => reject(spotlightPending.socketId)}
              style={{
                flex: 1,
                border: '1px solid rgba(239,68,68,0.28)',
                background: 'rgba(127,29,29,0.55)',
                color: '#fee2e2',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Refuser
            </button>
            <button
              onClick={() => admit(spotlightPending.socketId)}
              style={{
                flex: 1,
                border: '1px solid rgba(74,222,128,0.28)',
                background: 'rgba(21,128,61,0.58)',
                color: '#dcfce7',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Admettre
            </button>
          </div>
        </div>
      )}

      {/* Bouton hôte + badge file d'attente */}
      <button
        onClick={() => setShowPanel(p => !p)}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 10,
          background: showPanel ? '#d97706' : '#f59e0b',
          color: '#000', fontSize: 12, fontWeight: 700,
          border: 'none', cursor: 'pointer',
          transition: 'background 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <CrownIcon size={14} color="currentColor" />
        {iAmHost ? 'Hôte' : 'Co-hôte'}
        {/* Badge nombre en attente */}
        {hasPending && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            border: '2px solid #111827',
            animation: 'bounce 1s ease-in-out infinite',
          }}>
            {waitingList.length}
          </span>
        )}
      </button>

      {/* Panel déroulant */}
      {showPanel && (
        <>
          {/* Overlay clic extérieur */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setShowPanel(false)}
          />

          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '14px',
            width: 240, zIndex: 50,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            animation: 'slideDown 0.18s ease-out',
          }}>

            {/* Titre */}
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              color: '#f59e0b', textTransform: 'uppercase',
              margin: '0 0 12px',
            }}>
              Contrôles hôte
            </p>

            {/* ── File d'attente ── */}
            {hasPending && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#f59e0b',
                    boxShadow: '0 0 6px rgba(245,158,11,0.8)',
                    animation: 'breathe 1.4s ease-in-out infinite',
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                  }}>
                    En attente ({waitingList.length})
                  </span>
                </div>

                {waitingList.map(p => (
                  <WaitingEntry
                    key={p.socketId}
                    person={p}
                    onAdmit={admit}
                    onReject={reject}
                  />
                ))}

                {waitingList.length > 1 && (
                  <button onClick={admitAll} style={{
                    width: '100%', padding: '7px',
                    borderRadius: 8, border: '1px solid rgba(74,222,128,0.3)',
                    background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', marginBottom: 10,
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.1)'}
                  >
                    ✓ Admettre tout le monde
                  </button>
                )}

                <div style={{
                  height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0 12px',
                }} />
              </div>
            )}

            {/* ── Actions standards ── */}
            {[
              {
                icon: <MuteGroupIcon size={14} color="currentColor" />,
                label: 'Couper tous les micros',
                onClick: muteAll,
                style: { background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' },
              },
              {
                icon: locked
                  ? <ShieldOpenIcon size={14} color="currentColor" />
                  : <ShieldLockIcon size={14} color="currentColor" />,
                label: locked ? 'Déverrouiller la salle' : 'Verrouiller la salle',
                onClick: toggleLock,
                style: locked
                  ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                  : { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
              },
              {
                icon: <SparkIcon size={14} color="currentColor" />,
                label: 'Salles de groupes',
                onClick: () => { setBreakoutOpen(true); setShowPanel(false); },
                style: { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
              },
            ].map(({ icon, label, onClick, style }) => (
              <button
                key={label}
                onClick={onClick}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 9,
                  border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, marginBottom: 5,
                  fontFamily: 'inherit', transition: 'filter 0.15s',
                  ...style,
                }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                {icon}
                {label}
              </button>
            ))}

            {/* Fermer */}
            <button onClick={() => setShowPanel(false)} style={{
              width: '100%', marginTop: 6, padding: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'rgba(255,255,255,0.25)',
              fontFamily: 'inherit', textAlign: 'center',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            >
              Fermer
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes breathe {
          0%,100%{ opacity:1; } 50%{ opacity:0.4; }
        }
        @keyframes bounce {
          0%,100%{ transform:scale(1); }
          50%    { transform:scale(1.2); }
        }
      `}</style>
    </div>
  );
}
