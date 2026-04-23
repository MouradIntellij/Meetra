import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../../context/RoomContext.jsx';

export default function VideoTile({
                                      stream,
                                      name,
                                      socketId,
                                      isLocal = false,
                                      isActive = false,
                                      muted = false,
                                      videoOff = false,
                                      handRaised = false,
                                      isHost = false,
                                      className = '',
                                  }) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const { screenSharingId } = useRoom();

    // 🎥 Attach stream + fix mirror
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;

        el.srcObject = stream;

        // ✅ MIRROR FIX:
        // - Local camera tile → mirror (natural selfie view)
        // - Remote streams → NEVER mirror
        // - Screen share stream → NEVER mirror (would flip text/UI)
        const isScreenShare = screenSharingId === socketId && !isLocal;
        if (isLocal && !isScreenShare) {
            el.style.transform = 'scaleX(-1)';
        } else {
            el.style.transform = 'none';
        }

        el.play().catch(() => {});

        return () => {
            el.srcObject = null;
        };
    }, [stream, isLocal, screenSharingId, socketId]);

    const isScreenSharer = screenSharingId === socketId;

    // Avatar gradient based on name
    const avatarColors = [
        ['#1d4ed8', '#7c3aed'],
        ['#065f46', '#0891b2'],
        ['#92400e', '#b45309'],
        ['#7c3aed', '#db2777'],
        ['#1e40af', '#0369a1'],
        ['#166534', '#15803d'],
    ];
    const colorPair = avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];

    return (
        <div
            ref={containerRef}
            className={`relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 ${className}`}
            style={{
                outline: isActive
                    ? '2px solid #22c55e'
                    : isScreenSharer
                        ? '3px solid #22c55e'
                        : 'none',
                outlineOffset: isScreenSharer ? '-3px' : '-2px',
                boxShadow: isActive || isScreenSharer
                    ? '0 0 20px rgba(34,197,94,0.3)'
                    : 'none',
                minHeight: 80,
            }}
        >
            {/* 🎥 VIDEO */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`w-full h-full object-cover ${stream && !videoOff ? 'block' : 'hidden'}`}
                style={{ display: stream && !videoOff ? 'block' : 'none' }}
            />

            {/* 👤 AVATAR when no video */}
            {(!stream || videoOff) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${colorPair[0]}, ${colorPair[1]})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 700, color: '#fff',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    }}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500 }}>
            {name}
          </span>
                </div>
            )}

            {/* 🏷️ NAME BAR */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '14px 8px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    {muted && (
                        <div style={{
                            background: 'rgba(239,68,68,0.85)', borderRadius: 4,
                            padding: '1px 5px', fontSize: 9,
                        }}>🔇</div>
                    )}
                    {videoOff && (
                        <div style={{
                            background: 'rgba(239,68,68,0.85)', borderRadius: 4,
                            padding: '1px 5px', fontSize: 9,
                        }}>📷</div>
                    )}
                    <span style={{
                        color: '#f1f5f9', fontSize: 11, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 110,
                    }}>
            {name}
                        {isLocal && <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}> (Vous)</span>}
                        {isHost && <span style={{ color: '#fbbf24' }}> 👑</span>}
          </span>
                </div>

                {handRaised && (
                    <span style={{
                        fontSize: 14,
                        animation: 'handWave 0.8s ease-in-out infinite alternate',
                        display: 'inline-block',
                    }}>
            ✋
          </span>
                )}
            </div>

            {/* 📺 SCREEN SHARE BADGE */}
            {isScreenSharer && (
                <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(34,197,94,0.9)',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 4,
                    backdropFilter: 'blur(4px)',
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                    Partage écran
                </div>
            )}

            {/* Speaking indicator */}
            {isActive && !isScreenSharer && (
                <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px rgba(34,197,94,0.8)',
                    animation: 'pulse 1s ease-in-out infinite',
                }} />
            )}

            <style>{`
        @keyframes handWave {
          from { transform: rotate(-10deg); }
          to { transform: rotate(10deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
        </div>
    );
}