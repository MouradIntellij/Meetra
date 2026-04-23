import { useEffect, useRef, useState } from 'react';
import { useMedia }  from '../../context/MediaContext.jsx';
import { useRoom }   from '../../context/RoomContext.jsx';
import { useUI }     from '../../context/UIContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import VideoTile     from './VideoTile.jsx';

// ─── PiP Camera overlay (local cam during screen share) ──────
function PipCamera({ stream, name, muted, videoOff }) {
    const videoRef = useRef(null);
    const [hover, setHover] = useState(false);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;
        el.srcObject = stream;
        el.play().catch(() => {});
        return () => { el.srcObject = null; };
    }, [stream]);

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                position: 'absolute',
                bottom: 80,
                right: 16,
                width: 200,
                height: 113,
                zIndex: 60,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.25)',
                background: '#111',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                transition: 'transform 0.2s, opacity 0.2s',
                transform: hover ? 'scale(1.04)' : 'scale(1)',
                cursor: 'grab',
            }}
        >
            {stream && !videoOff ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        // ✅ FIX MIRROR: local cam should be mirrored for self-view only
                        transform: 'scaleX(-1)',
                    }}
                />
            ) : (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 6, background: '#1a1f2e',
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: '#fff',
                    }}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            )}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                padding: '12px 8px 5px',
                fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
            }}>
                {muted && <span style={{ color: '#f87171', fontSize: 9 }}>🔇</span>}
                Vous
            </div>
        </div>
    );
}

// ─── Screen Share Fullscreen View (Teams/Zoom style) ─────────
function ScreenShareFullscreen({ screenStream, localStream, participants, remoteStreams, hostId, audioEnabled, videoEnabled, activeSpeakerId }) {
    const screenVideoRef = useRef(null);

    useEffect(() => {
        const el = screenVideoRef.current;
        if (!el || !screenStream) return;
        el.srcObject = screenStream;
        // ✅ FIX: screen share MUST NOT be mirrored
        el.style.transform = 'none';
        el.play().catch(() => {});
        return () => { el.srcObject = null; };
    }, [screenStream]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#0a0a0f',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* ── MAIN SCREEN AREA ── */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                // ✅ Green border like Zoom when sharing
                outline: '3px solid #22c55e',
                outlineOffset: '-3px',
            }}>
                <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        // ✅ CRITICAL: NEVER mirror screen share
                        transform: 'none !important',
                        background: '#000',
                    }}
                />

                {/* Top bar: sharing indicator */}
                <div style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(34,197,94,0.95)',
                    color: '#fff',
                    borderRadius: 20,
                    padding: '5px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10,
                }}>
          <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#fff',
              animation: 'pulse 1.5s ease-in-out infinite',
          }} />
                    Partage d'écran en cours
                </div>
            </div>

            {/* ── BOTTOM FILMSTRIP: participants ── */}
            <div style={{
                height: 100,
                background: 'rgba(10,10,20,0.95)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                overflowX: 'auto',
                flexShrink: 0,
            }}>
                {/* Local user tile */}
                <FilmstripTile
                    stream={localStream}
                    name="Vous"
                    isLocal
                    muted={!audioEnabled}
                    videoOff={!videoEnabled}
                    isActive={false}
                />

                {/* Remote participants */}
                {participants.map(p => (
                    <FilmstripTile
                        key={p.socketId}
                        stream={remoteStreams.get(p.socketId)}
                        name={p.name}
                        isHost={p.socketId === hostId}
                        muted={!p.audioEnabled}
                        videoOff={!p.videoEnabled}
                        handRaised={p.handRaised}
                        isActive={activeSpeakerId === p.socketId}
                    />
                ))}
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
        </div>
    );
}

// ─── Filmstrip tile (bottom bar during screen share) ─────────
function FilmstripTile({ stream, name, isLocal, isHost, muted, videoOff, handRaised, isActive }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;
        el.srcObject = stream;
        // ✅ Mirror only local camera, NEVER screen share
        if (isLocal) {
            el.style.transform = 'scaleX(-1)';
        } else {
            el.style.transform = 'none';
        }
        el.play().catch(() => {});
        return () => { el.srcObject = null; };
    }, [stream, isLocal]);

    return (
        <div style={{
            position: 'relative',
            width: 140,
            height: 78,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            background: '#1a1f2e',
            border: isActive
                ? '2px solid #22c55e'
                : handRaised
                    ? '2px solid #f59e0b'
                    : '1px solid rgba(255,255,255,0.1)',
            transition: 'border-color 0.2s',
        }}>
            {stream && !videoOff ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#1e2440',
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            )}

            {/* Name bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                padding: '10px 5px 4px',
                display: 'flex', alignItems: 'center', gap: 3,
            }}>
                {muted && <span style={{ fontSize: 8, color: '#f87171' }}>🔇</span>}
                <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 600, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
          {name}{isHost ? ' 👑' : ''}
                    {isLocal ? ' (Vous)' : ''}
        </span>
                {handRaised && <span style={{ fontSize: 10, marginLeft: 'auto' }}>✋</span>}
            </div>

            {/* Active speaker glow */}
            {isActive && (
                <div style={{
                    position: 'absolute', inset: 0,
                    boxShadow: 'inset 0 0 12px rgba(34,197,94,0.4)',
                    borderRadius: 8, pointerEvents: 'none',
                }} />
            )}
        </div>
    );
}

// ─── Main VideoGrid component ─────────────────────────────────
export default function VideoGrid() {
    const {
        localStream,
        remoteStreams,
        audioEnabled,
        videoEnabled,
        screenStream,
    } = useMedia();

    const { participants, hostId } = useRoom();
    const { activeSpeakerId, layout } = useUI();
    const { socket } = useSocket();

    // ── SCREEN SHARE MODE (Teams/Zoom style fullscreen) ──────
    if (screenStream) {
        return (
            <ScreenShareFullscreen
                screenStream={screenStream}
                localStream={localStream}
                participants={participants}
                remoteStreams={remoteStreams}
                hostId={hostId}
                audioEnabled={audioEnabled}
                videoEnabled={videoEnabled}
                activeSpeakerId={activeSpeakerId}
            />
        );
    }

    // ── SPOTLIGHT MODE (one big speaker + filmstrip) ──────────
    if (layout === 'spotlight' && (participants.length > 0 || activeSpeakerId)) {
        const spotlightId = activeSpeakerId || participants[0]?.socketId;
        const spotlightP = participants.find(p => p.socketId === spotlightId);
        const isLocalSpotlight = !spotlightP;
        const spotlightStream = isLocalSpotlight ? localStream : remoteStreams.get(spotlightId);
        const spotlightName = isLocalSpotlight ? 'Vous' : (spotlightP?.name ?? 'Participant');

        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#080c14' }}>
                {/* Main spotlight */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <VideoTile
                        stream={spotlightStream}
                        name={spotlightName}
                        isLocal={isLocalSpotlight}
                        isActive
                        muted={isLocalSpotlight ? !audioEnabled : !spotlightP?.audioEnabled}
                        videoOff={isLocalSpotlight ? !videoEnabled : !spotlightP?.videoEnabled}
                        handRaised={spotlightP?.handRaised}
                        isHost={spotlightP?.socketId === hostId}
                        className="w-full h-full"
                    />
                    {/* Spotlight label */}
                    <div style={{
                        position: 'absolute', top: 12, left: 12,
                        background: 'rgba(59,130,246,0.85)',
                        color: '#fff', borderRadius: 6, padding: '3px 10px',
                        fontSize: 11, fontWeight: 700,
                    }}>
                        📌 En vedette
                    </div>
                </div>

                {/* Filmstrip */}
                <div style={{
                    height: 90, background: 'rgba(8,12,20,0.98)',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    overflowX: 'auto',
                }}>
                    {!isLocalSpotlight && (
                        <FilmstripTile
                            stream={localStream}
                            name="Vous"
                            isLocal
                            muted={!audioEnabled}
                            videoOff={!videoEnabled}
                            isActive={activeSpeakerId === socket?.id}
                        />
                    )}
                    {participants.filter(p => p.socketId !== spotlightId).map(p => (
                        <FilmstripTile
                            key={p.socketId}
                            stream={remoteStreams.get(p.socketId)}
                            name={p.name}
                            isHost={p.socketId === hostId}
                            muted={!p.audioEnabled}
                            videoOff={!p.videoEnabled}
                            handRaised={p.handRaised}
                            isActive={activeSpeakerId === p.socketId}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ── DEFAULT GRID MODE ─────────────────────────────────────
    const totalCount = participants.length + 1; // +1 for local

    // Compute responsive grid columns
    const cols = totalCount <= 1 ? 1
        : totalCount <= 2 ? 2
            : totalCount <= 4 ? 2
                : totalCount <= 6 ? 3
                    : 4;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 6,
            padding: 6,
            height: '100%',
            background: '#080c14',
            boxSizing: 'border-box',
        }}>
            {/* Local tile */}
            <VideoTile
                stream={localStream}
                name="Vous"
                isLocal
                isActive={activeSpeakerId === socket?.id}
                muted={!audioEnabled}
                videoOff={!videoEnabled}
                className="w-full h-full"
            />

            {/* Remote tiles */}
            {participants.map(p => (
                <VideoTile
                    key={p.socketId}
                    stream={remoteStreams.get(p.socketId)}
                    name={p.name}
                    socketId={p.socketId}
                    isActive={activeSpeakerId === p.socketId}
                    muted={!p.audioEnabled}
                    videoOff={!p.videoEnabled}
                    handRaised={p.handRaised}
                    isHost={p.socketId === hostId}
                    className="w-full h-full"
                />
            ))}
        </div>
    );
}