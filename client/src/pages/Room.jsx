import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket }     from '../context/SocketContext.jsx';
import { useRoom }       from '../context/RoomContext.jsx';
import { useUI }         from '../context/UIContext.jsx';
import { useMedia }      from '../context/MediaContext.jsx';
import { useWebRTC }     from '../hooks/useWebRTC.js';
import { EVENTS }        from '../utils/events.js';
import { platform }      from '../services/platform/index.js';

import VideoGrid         from '../components/video/VideoGrid.jsx';
import ControlBar        from '../components/controls/ControlBar.jsx';
import HostControls      from '../components/controls/HostControls.jsx';
import ChatSidebar       from '../components/chat/ChatSidebar.jsx';
import ParticipantsPanel from '../components/participants/ParticipantsPanel.jsx';
import Whiteboard        from '../components/layout/Whiteboard.jsx';
import BreakoutPanel     from '../components/layout/BreakoutPanel.jsx';
import ReactionsOverlay  from '../components/layout/ReactionsOverlay.jsx';
import CaptionsOverlay   from '../components/transcription/CaptionsOverlay.jsx';
import TranscriptPanel   from '../components/transcription/TranscriptPanel.jsx';

const PUBLIC_JOIN_BASE_URL = import.meta.env.VITE_PUBLIC_JOIN_BASE_URL || '';

function resolveInviteBaseUrl() {
  if (PUBLIC_JOIN_BASE_URL) {
    return PUBLIC_JOIN_BASE_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return '';
}

function buildInviteLink(roomId) {
  const baseUrl = resolveInviteBaseUrl();
  if (!baseUrl) return roomId;
  return `${baseUrl}/room/${roomId}`;
}

function formatIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function downloadInviteIcs({ roomId, link }) {
  const now = new Date();
  const end = new Date(now.getTime() + (60 * 60 * 1000));
  const stamp = formatIcsDate(new Date());
  const start = formatIcsDate(now);
  const finish = formatIcsDate(end);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meetra//Meeting Invite//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${roomId}@meetra`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${finish}`,
    `SUMMARY:Reunion Meetra`,
    `DESCRIPTION:Rejoignez la reunion Meetra via ce lien: ${link}`,
    `LOCATION:${link}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `invitation-${roomId}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}



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

// ── Invite Dialog ─────────────────────────────────────────────
function InviteDialog({ roomId, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [calendarSaved, setCalendarSaved] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const link = buildInviteLink(roomId);
  const hasPublicLink = /^https?:\/\//i.test(link);

  const recipients = emailInput
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const inviteSubject = encodeURIComponent('Invitation a rejoindre la reunion');
  const inviteBody = encodeURIComponent(`Bonjour,\n\nRejoignez ma reunion avec ce lien :\n${link}\n\nA bientot.`);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpen = async () => {
    if (!hasPublicLink) return;
    await platform.openExternal(link);
    setOpened(true);
    setTimeout(() => setOpened(false), 2500);
  };

  const handleEmail = async () => {
    if (!hasPublicLink) return;
    const to = recipients.join(',');
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${inviteSubject}&body=${inviteBody}`;

    if (platform.isElectron) {
      await platform.openExternal(mailtoUrl);
    } else {
      window.location.href = mailtoUrl;
    }

    setEmailed(true);
    setTimeout(() => setEmailed(false), 2500);
  };

  const handleCalendar = () => {
    if (!hasPublicLink) return;
    downloadInviteIcs({ roomId, link });
    setCalendarSaved(true);
    setTimeout(() => setCalendarSaved(false), 2500);
  };

  return (
      <div
          onClick={e => e.target === e.currentTarget && onDismiss()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(2,6,23,0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
      >
        <div style={{
          width: 'min(680px, 100%)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.98) 100%)',
          border: '1px solid rgba(148,163,184,0.18)',
          borderRadius: 24,
          boxShadow: '0 30px 80px rgba(2,6,23,0.5)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 22px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.7)', fontWeight: 700 }}>
                Invitation
              </div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>
                Inviter des participants
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(226,232,240,0.72)', lineHeight: 1.5 }}>
                Partagez ce lien public pour permettre a un invite Internet de rejoindre la reunion.
              </div>
            </div>
            <button
                onClick={onDismiss}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid rgba(148,163,184,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  fontSize: 16,
                  flexShrink: 0,
                }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: 22, display: 'grid', gap: 18 }}>
            <div style={{
              border: '1px solid rgba(96,165,250,0.16)',
              background: 'rgba(37,99,235,0.08)',
              borderRadius: 18,
              padding: 16,
            }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#93c5fd', fontWeight: 700, marginBottom: 10 }}>
                Lien de reunion
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: '#dbeafe',
                lineHeight: 1.6,
                wordBreak: 'break-all',
                background: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.14)',
                borderRadius: 14,
                padding: '12px 14px',
              }}>
                {link}
              </div>
              {!hasPublicLink && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(248,250,252,0.58)', lineHeight: 1.5 }}>
                    Configurez `VITE_PUBLIC_JOIN_BASE_URL` pour partager un vrai lien web public depuis Electron.
                  </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.82)', fontWeight: 700 }}>
                Envoyer par email
              </div>
              <textarea
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="alice@entreprise.com, bob@entreprise.com"
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(15,23,42,0.62)',
                    color: '#f8fafc',
                    padding: '12px 14px',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
              />
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.75)' }}>
                Vous pouvez separer plusieurs adresses par des virgules, points-virgules ou retours a la ligne.
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                  onClick={handleCopy}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: copied ? 'rgba(34,197,94,0.22)' : '#2563eb',
                    color: copied ? '#4ade80' : '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
              >
                {copied ? '✓ Lien copie' : 'Copier le lien'}
              </button>

              <button
                  onClick={handleEmail}
                  disabled={!hasPublicLink}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: emailed ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)',
                    color: emailed ? '#4ade80' : hasPublicLink ? '#e2e8f0' : 'rgba(148,163,184,0.55)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: hasPublicLink ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
              >
                {emailed ? '✓ Email prepare' : 'Ouvrir email'}
              </button>

              <button
                  onClick={handleCalendar}
                  disabled={!hasPublicLink}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: calendarSaved ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)',
                    color: calendarSaved ? '#4ade80' : hasPublicLink ? '#e2e8f0' : 'rgba(148,163,184,0.55)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: hasPublicLink ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
              >
                {calendarSaved ? '✓ Calendrier telecharge' : 'Telecharger .ics'}
              </button>

              {platform.isElectron && hasPublicLink && (
                  <button
                      onClick={handleOpen}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: opened ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)',
                        color: opened ? '#4ade80' : '#e2e8f0',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                  >
                    {opened ? '✓ Lien ouvert' : 'Ouvrir le lien web'}
                  </button>
              )}

              <button
                  onClick={onDismiss}
                  style={{
                    marginLeft: 'auto',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'transparent',
                    color: 'rgba(226,232,240,0.8)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

// ── Room ──────────────────────────────────────────────────────
export default function Room({ roomId, userName, onLeave }) {
  const { socket, connected }       = useSocket();
  const { participants, hostId }    = useRoom();
  const { screenStream, leaveRoom, screenShareError, clearScreenShareError } = useMedia();
  const { layout, toggleLayout }    = useUI();

  const { joinRoom, toggleHand } = useWebRTC(roomId, userName);

  const [joined,      setJoined]      = useState(false);
  const [kicked,      setKicked]      = useState(false);
  const [showInvite,  setShowInvite]  = useState(true);
  const [handRaised,  setHandRaised]  = useState(false);
  const [showHands,   setShowHands]   = useState(false);
    //ajout pour resolution du problem effet miroir lors  du full sharing screen
  const [isScreenShareActive, setIsScreenShareActive] = useState(false);

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
    joinRoom().then(() => setJoined(true)).catch(() => {});
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
        backgroundImage: 'radial-gradient(circle at top, rgba(37,99,235,0.14), transparent 30%), radial-gradient(circle at bottom right, rgba(34,197,94,0.12), transparent 28%)',
      }}>

        {/* ── HEADER (Teams-style) ── */}
        <div style={{
          minHeight: 56,
          background: 'linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(2,6,23,0.88) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 30,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 10px 30px rgba(2,6,23,0.28)',
        }}>
          {/* Left: branding + room info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(37,99,235,0.28), rgba(16,185,129,0.18))',
                border: '1px solid rgba(96,165,250,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 24px rgba(37,99,235,0.18)',
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
                  VideoConf
                </span>
                <span style={{ color: 'rgba(148,163,184,0.82)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>
                  Session live
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)' }} />

            <span style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 11,
              fontFamily: 'monospace',
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
            {roomId.slice(0, 8).toUpperCase()}…
          </span>

            {/* Participant count */}
            <div style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.22)',
              borderRadius: 999, padding: '5px 10px',
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
                  border: '1px solid rgba(34,197,94,0.24)',
                  borderRadius: 999, padding: '5px 10px',
                  fontSize: 11, color: '#4ade80', fontWeight: 600,
                  boxShadow: '0 10px 26px rgba(34,197,94,0.12)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { id: 'grid', label: '⊞', title: 'Grille' },
              { id: 'spotlight', label: '📌', title: 'Vedette' },
            ].map(({ id, label, title }) => (
                <button
                    key={id}
                    onClick={() => id !== layout && toggleLayout()}
                    title={title}
                    style={{
                      padding: '6px 12px', borderRadius: 999, border: 'none',
                      background: layout === id ? 'rgba(59,130,246,0.22)' : 'transparent',
                      color: layout === id ? '#bfdbfe' : 'rgba(255,255,255,0.45)',
                      fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      fontWeight: 700,
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
                      padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,0.14)',
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
                  padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)',
                  background: showInvite ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                  color: showInvite ? '#bfdbfe' : 'rgba(255,255,255,0.58)',
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

        {/* ── INVITE DIALOG ── */}
        {showInvite && (
            <InviteDialog roomId={roomId} onDismiss={() => setShowInvite(false)} />
        )}

        {screenShareError && (
            <div style={{
              margin: '10px 16px 0',
              borderRadius: 14,
              border: '1px solid rgba(248,113,113,0.22)',
              background: 'rgba(127,29,29,0.22)',
              color: '#fee2e2',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 13,
              boxShadow: '0 12px 30px rgba(2,6,23,0.18)',
            }}>
              <span>{screenShareError}</span>
              <button
                  onClick={clearScreenShareError}
                  style={{
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: 999,
                    width: 28,
                    height: 28,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
              >
                ×
              </button>
            </div>
        )}

        {/* ── RAISED HANDS FLOATING PANEL ── */}
        {showHands && raisedCount > 0 && (
            <div style={{ position: 'absolute', top: 54, right: 12, zIndex: 40 }}>
              <RaisedHandsAlert participants={participants} />
            </div>
        )}

        {/* ── MAIN AREA ── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <VideoGrid isScreenShareActive={isScreenShareActive} />
                  <ReactionsOverlay />
                  <CaptionsOverlay />
              </div>

          {/* Sidebars */}
          <ParticipantsPanel roomId={roomId} />
          <ChatSidebar roomId={roomId} userName={userName} userId={socket?.id} />
          <TranscriptPanel />
        </div>

        {/* ── CONTROL BAR ── */}
          <div style={{ flexShrink: 0 }}>
              <ControlBar
                  roomId={roomId}
                  userName={userName}
                  onLeave={handleLeave}
                  toggleHand={handleToggleHand}
                  handRaised={handRaised}
                  onScreenShareChange={setIsScreenShareActive}
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
