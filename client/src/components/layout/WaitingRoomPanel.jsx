// client/src/components/layout/WaitingRoomPanel.jsx
// Panneau affiché à l'HÔTE dans la Room (ou dans le Lobby).
// Montre les guests en attente et permet de les admettre ou refuser.
// Props : roomId

import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { getApiUrl } from '../../utils/appConfig.js';
import {
  WAITING_ROOM_GUEST,
  WAITING_ROOM_UPDATE,
  ADMIT_GUEST,
  DENY_GUEST,
} from '../../utils/events.js';

const API_URL = getApiUrl();
const AUTH_STORAGE_KEY = 'meetra-auth-session';

function readStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    return parsed.token || '';
  } catch {
    return '';
  }
}

export default function WaitingRoomPanel({ roomId }) {
  const { socket } = useSocket();
  const [queue, setQueue] = useState([]); // [{ socketId, userName, joinedAt }]
  const [processing, setProcessing] = useState({}); // socketId → 'admitting'|'denying'

  useEffect(() => {
    let active = true;

    const loadQueue = async () => {
      const token = readStoredAuthToken();
      if (!token || !roomId) return;

      try {
        const res = await fetch(`${API_URL}/api/rooms/${roomId}/waiting`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setQueue(Array.isArray(data.queue) ? data.queue : []);
      } catch {
        // ignore sync failures, realtime socket remains active
      }
    };

    loadQueue();
    const intervalId = window.setInterval(loadQueue, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [roomId]);

  // Écouter les nouveaux guests en attente
  useEffect(() => {
    if (!socket) return;

    const handleNewGuest = (guest) => {
      setQueue((prev) => {
        // Éviter les doublons si reconnexion
        if (prev.some((g) => g.socketId === guest.socketId)) return prev;
        return [...prev, guest];
      });
    };
    const handleQueueUpdate = ({ waitingList }) => {
      if (Array.isArray(waitingList)) {
        setQueue(waitingList);
        setProcessing((current) => {
          const next = {};
          waitingList.forEach((guest) => {
            if (current[guest.socketId]) next[guest.socketId] = current[guest.socketId];
          });
          return next;
        });
      }
    };

    socket.on(WAITING_ROOM_GUEST, handleNewGuest);
    socket.on(WAITING_ROOM_UPDATE, handleQueueUpdate);
    return () => {
      socket.off(WAITING_ROOM_GUEST, handleNewGuest);
      socket.off(WAITING_ROOM_UPDATE, handleQueueUpdate);
    };
  }, [socket]);

  const admit = (guest) => {
    if (!socket) return;
    setProcessing((p) => ({ ...p, [guest.socketId]: 'admitting' }));
    socket.emit(ADMIT_GUEST, { roomId, guestSocketId: guest.socketId });
    // Retirer de la liste locale après un délai
    setTimeout(() => {
      setQueue((q) => q.filter((g) => g.socketId !== guest.socketId));
      setProcessing((p) => { const n = { ...p }; delete n[guest.socketId]; return n; });
    }, 600);
  };

  const deny = (guest) => {
    if (!socket) return;
    setProcessing((p) => ({ ...p, [guest.socketId]: 'denying' }));
    socket.emit(DENY_GUEST, { roomId, guestSocketId: guest.socketId });
    setTimeout(() => {
      setQueue((q) => q.filter((g) => g.socketId !== guest.socketId));
      setProcessing((p) => { const n = { ...p }; delete n[guest.socketId]; return n; });
    }, 600);
  };

  const admitAll = () => queue.forEach(admit);

  // Temps d'attente formaté
  const waitTime = (joinedAt) => {
    const secs = Math.floor((Date.now() - joinedAt) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m${secs % 60}s`;
  };

  // Ne rien afficher s'il n'y a personne en attente
  if (queue.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeOut {
          to { opacity:0; transform:scale(0.95); }
        }
        .wr-item { animation: slideIn 0.25s ease-out; }
        .wr-item.leaving { animation: fadeOut 0.3s ease-out forwards; }
        .wr-btn-admit:hover { opacity:0.85; }
        .wr-btn-deny:hover  { background: rgba(239,68,68,0.2) !important; border-color: rgba(239,68,68,0.4) !important; }
      `}</style>

      <div style={panelStyle}>
        {/* En-tête */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            {/* Badge nombre */}
            <span style={{
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '20px', height: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              {queue.length}
            </span>
            <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 700 }}>
              En salle d'attente
            </span>
          </div>
          {queue.length > 1 && (
            <button onClick={admitAll} style={btnAdmitAllStyle}>
              Tout admettre
            </button>
          )}
        </div>

        {/* Liste des guests */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {queue.map((guest) => {
            const status = processing[guest.socketId];
            return (
              <div
                key={guest.socketId}
                className={`wr-item${status ? ' leaving' : ''}`}
                style={guestRowStyle}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: `hsl(${guest.userName.charCodeAt(0) * 53 % 360}, 55%, 35%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 800, color: 'white',
                }}>
                  {guest.userName.slice(0, 2).toUpperCase()}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {guest.userName}
                  </p>
                  <p style={{ margin:0, fontSize:'11px', color:'#475569', marginTop:'1px' }}>
                    Attend depuis {waitTime(guest.joinedAt)}
                  </p>
                </div>

                {/* Boutons */}
                {!status && (
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <button
                      className="wr-btn-deny"
                      onClick={() => deny(guest)}
                      title="Refuser"
                      style={btnDenyStyle}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                    <button
                      className="wr-btn-admit"
                      onClick={() => admit(guest)}
                      title="Admettre"
                      style={btnAdmitStyle}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Admettre
                    </button>
                  </div>
                )}

                {/* Feedback visuel pendant l'action */}
                {status === 'admitting' && (
                  <span style={{ fontSize:'12px', color:'#10b981', fontWeight:700 }}>✓ Admis</span>
                )}
                {status === 'denying' && (
                  <span style={{ fontSize:'12px', color:'#ef4444', fontWeight:700 }}>✗ Refusé</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const panelStyle = {
  position: 'fixed',
  top: '80px',
  right: '16px',
  zIndex: 200,
  background: 'linear-gradient(160deg, #111827, #0d1322)',
  border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: '16px',
  padding: '16px',
  width: '320px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.1)',
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

const guestRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '10px 12px',
};

const btnAdmitStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'linear-gradient(135deg, #10b981, #059669)',
  border: 'none',
  borderRadius: '8px',
  padding: '6px 12px',
  color: 'white',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'opacity 0.2s',
};

const btnDenyStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: '8px',
  padding: '6px 8px',
  color: '#ef4444',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const btnAdmitAllStyle = {
  background: 'rgba(16,185,129,0.12)',
  border: '1px solid rgba(16,185,129,0.25)',
  borderRadius: '8px',
  padding: '4px 10px',
  color: '#10b981',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
