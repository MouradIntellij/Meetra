import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket }     from '../context/SocketContext.jsx';
import { useRoom }       from '../context/RoomContext.jsx';
import { useUI }         from '../context/UIContext.jsx';
import { useMedia }      from '../context/MediaContext.jsx';
import { useWebRTC }     from '../hooks/useWebRTC.js';
import { EVENTS }        from '../utils/events.js';

import VideoGrid         from '../components/video/VideoGrid.jsx';
import ControlBar        from '../components/controls/ControlBar.jsx';
import HostControls      from '../components/controls/HostControls.jsx';
import ChatSidebar       from '../components/chat/ChatSidebar.jsx';
import ParticipantsPanel from '../components/participants/ParticipantsPanel.jsx';
import Whiteboard        from '../components/layout/Whiteboard.jsx';
import BreakoutPanel     from '../components/layout/BreakoutPanel.jsx';
import ReactionsOverlay  from '../components/layout/ReactionsOverlay.jsx';

// ── Meeting Timer ─────────────────────────────────────────────
function MeetingTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const fmt = h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return (
      <div style={{
        fontSize: 12, color: 'rgba(255,255,255,0.5)',
        fontFamily: 'monospace', fontWeight: 600,
        background: 'rgba(255,255,255,0.06)',
        padding: '3px 10px', borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {fmt}
      </div>
  );
}

// ── Raised Hands Notification Panel ──────────────────────────
function RaisedHandsAlert({ participants }) {
  const raisedHands = participants.filter(p => p.handRaised);
  if (raisedHands.length === 0) return null;

  return (
      <div style={{
        position: 'absolute',
        top: 52,
        right: 12,
        zIndex: 40,
        background: 'rgba(17,24,39,0.97)',
        border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 220,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideDownFade 0.25s ease-out',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#f59e0b',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ fontSize: 14 }}>✋</span>
          Main levée ({raisedHands.length})
        </div>
        {raisedHands.map(p => (
            <div key={p.socketId} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {p.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>
            {p.name}
          </span>
              <span style={{ marginLeft: 'auto', fontSize: 14, animation: 'wave 0.8s ease-in-out infinite alternate' }}>✋</span>
            </div>
        ))}
        <style>{`
        @keyframes wave {
          from { transform: rotate(-10deg); }
          to { transform: rotate(10deg); }
        }
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      </div>
  );
}

// ── Network quality indicator ─────────────────────────────────
function NetworkQuality() {
  const [quality, setQuality] = useState('good'); // good | fair | poor

  useEffect(() => {
    if (!navigator.connection) return;
    const update = () => {
      const conn = navigator.connection;
      if (conn.effectiveType === '4g') setQuality('good');
      else if (conn.effectiveType === '3g') setQuality('fair');
      else setQuality('poor');
    };
    update();
    navigator.connection.addEventListener('change', update);
    return () => navigator.connection?.removeEventListener('change', update);
  }, []);

  const bars = quality === 'good' ? 3 : quality === 'fair' ? 2 : 1;
  const color = quality === 'good' ? '#22c55e' : quality === 'fair' ? '#f59e0b' : '#ef4444';

  return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, title: `Réseau: ${quality}` }}>
        {[1, 2, 3].map(b => (
            <div key={b} style={{
              width: 3,
              height: 4 + b * 3,
              borderRadius: 1,
              background: b <= bars ? color : 'rgba(255,255,255,0.15)',
              transition: 'background 0.3s',
            }} />
        ))}
      </div>
  );
}

// ── Invite Banner ─────────────────────────────────────────────
function InviteBanner({ roomId, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${roomId}`;

  return (
      <div style={{
        background: 'rgba(37,99,235,0.12)',
        borderBottom: '1px solid rgba(59,130,246,0.2)',
        padding: '6px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span style={{
          color: '#93c5fd', fontSize: 11, fontFamily: 'monospace',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
        {link}
      </span>
        <button
            onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
            style={{
              flexShrink: 0,
              padding: '3px 10px', borderRadius: 6, border: 'none',
              background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
              color: copied ? '#4ade80' : '#93c5fd',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
        >
          {copied ? '✓ Copié' : 'Copier'}
        </button>
        <button
            onClick={onDismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)', padding: 2, fontSize: 14, lineHeight: 1,
            }}
        >
          ×
        </button>
      </div>
  );
}

// ── Room ──────────────────────────────────────────────────────
export default function Room({ roomId, userName, onLeave }) {
  const { socket, connected }       = useSocket();
  const { participants, hostId }    = useRoom();
  const { screenStream, leaveRoom } = useMedia();
  const { layout, toggleLayout }    = useUI();

  const { joinRoom, toggleHand } = useWebRTC(roomId, userName);

  const [joined,      setJoined]      = useState(false);
  const [kicked,      setKicked]      = useState(false);
  const [showInvite,  setShowInvite]  = useState(true);
  const [handRaised,  setHandRaised]  = useState(false);
  const [showHands,   setShowHands]   = useState(false);

  // Auto-show raised hands panel when someone raises hand
  const raisedCount = participants.filter(p => p.handRaised).length;
  const prevRaisedCount = useRef(0);
  useEffect(() => {
    if (raisedCount > prevRaisedCount.current) {
      setShowHands(true);
    }
    prevRaisedCount.current = raisedCount;
  }, [raisedCount]);

  useEffect(() => {
    if (!connected || joined) return;
    joinRoom().then(() => setJoined(true)).catch(console.error);
  }, [connected, joined, joinRoom]);

  useEffect(() => {
    if (!socket) return;
    socket.on(EVENTS.KICKED, () => setKicked(true));
    return () => socket.off(EVENTS.KICKED);
  }, [socket]);

  const handleToggleHand = useCallback(() => {
    toggleHand();
    setHandRaised(prev => !prev);
  }, [toggleHand]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    onLeave();
  }, [leaveRoom, onLeave]);

  // ── KICKED ────────────────────────────────────────────────
  if (kicked) {
    return (
        <div style={{
          height: '100vh', background: '#030712',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            background: '#111827', borderRadius: 20, padding: 40,
            textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)',
            maxWidth: 360,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
            <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Vous avez été expulsé
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>
              L'hôte vous a retiré de cette réunion.
            </p>
            <button onClick={onLeave} style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: '#3b82f6', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Retour à l'accueil
            </button>
          </div>
        </div>
    );
  }

  // ── CONNECTING ────────────────────────────────────────────
  if (!connected) {
    return (
        <div style={{
          height: '100vh', background: '#030712',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #3b82f6',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              Connexion au serveur…
            </p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
  }

  return (
      <div style={{
        height: '100vh', background: '#030712',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}>

        {/* ── HEADER (Teams-style) ── */}
        <div style={{
          height: 44,
          background: '#111827',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 30,
        }}>
          {/* Left: branding + room info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>
              VideoConf
            </span>
            </div>

            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

            <span style={{
              color: 'rgba(255,255,255,0.35)', fontSize: 11,
              fontFamily: 'monospace',
            }}>
            {roomId.slice(0, 8).toUpperCase()}…
          </span>

            {/* Participant count */}
            <div style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 10, padding: '2px 8px',
              fontSize: 11, color: '#93c5fd', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {participants.length + 1}
            </div>

            {/* Screen sharing indicator */}
            {screenStream && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 10, padding: '2px 8px',
                  fontSize: 11, color: '#4ade80', fontWeight: 600,
                }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#4ade80', animation: 'pulse 1.2s infinite',
                display: 'inline-block',
              }} />
                  Partage actif
                </div>
            )}
          </div>

          {/* Center: layout toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[
              { id: 'grid', label: '⊞', title: 'Grille' },
              { id: 'spotlight', label: '📌', title: 'Vedette' },
            ].map(({ id, label, title }) => (
                <button
                    key={id}
                    onClick={() => id !== layout && toggleLayout()}
                    title={title}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: layout === id ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                      color: layout === id ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                      fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                >
                  {label}
                </button>
            ))}
          </div>

          {/* Right: tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NetworkQuality />
            <MeetingTimer />

            {/* Raised hands toggle */}
            {raisedCount > 0 && (
                <button
                    onClick={() => setShowHands(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 8, border: 'none',
                      background: showHands ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.12)',
                      color: '#f59e0b', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      animation: 'pulse 2s ease-in-out infinite',
                      transition: 'background 0.2s',
                    }}
                >
                  ✋ {raisedCount}
                </button>
            )}

            <HostControls roomId={roomId} />

            {/* Invite button */}
            <button
                onClick={() => setShowInvite(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 8, border: 'none',
                  background: showInvite ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                  color: showInvite ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Inviter
            </button>
          </div>
        </div>

        {/* ── INVITE BANNER ── */}
        {showInvite && (
            <InviteBanner roomId={roomId} onDismiss={() => setShowInvite(false)} />
        )}

        {/* ── RAISED HANDS FLOATING PANEL ── */}
        {showHands && raisedCount > 0 && (
            <div style={{ position: 'absolute', top: showInvite ? 82 : 54, right: 12, zIndex: 40 }}>
              <RaisedHandsAlert participants={participants} />
            </div>
        )}

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <VideoGrid />
            <ReactionsOverlay />
          </div>

          {/* Sidebars */}
          <ParticipantsPanel roomId={roomId} />
          <ChatSidebar roomId={roomId} userName={userName} userId={socket?.id} />
        </div>

        {/* ── CONTROL BAR ── */}
        <div style={{ flexShrink: 0 }}>
          <ControlBar
              roomId={roomId}
              userName={userName}
              onLeave={handleLeave}
              toggleHand={handleToggleHand}
              handRaised={handRaised}
          />
        </div>

        <Whiteboard roomId={roomId} />
        <BreakoutPanel roomId={roomId} />

        <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      </div>
  );
}