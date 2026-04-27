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

    // 🎥 Attach stream + FIX MIRROR PROPRE
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;

        el.srcObject = stream;

        el.style.transform = 'translateZ(0)';
        el.style.willChange = 'transform, opacity';
        el.style.opacity = '0.999';

        el.play().catch(() => {});

        return () => {
            el.srcObject = null;
        };
    }, [stream]);

    // 🟢 Screen sharer detection UI
    const isScreenSharer = screenSharingId === socketId;

    // 🎯 Auto focus (suppression de la logique inutilisée)

    // Avatar colors
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
                className={`w-full h-full object-cover ${
                    stream && !videoOff ? 'block' : 'hidden'
                }`}
                style={{
                    ...(isScreenSharer ? { objectFit: 'contain', background: '#050816' } : {}),
                    position: 'relative',
                    zIndex: 0,
                    transform: 'translateZ(0)',
                    willChange: 'transform, opacity',
                    opacity: 0.999,
                    backfaceVisibility: 'hidden',
                }}
            />

            {/* 👤 AVATAR */}
            {(!stream || videoOff) && (
                <div className="flex flex-col items-center gap-2">
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${colorPair[0]}, ${colorPair[1]})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#fff',
                        }}
                    >
                        {name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-gray-400 text-sm">{name}</span>
                </div>
            )}

            {/* 🏷️ NAME BAR */}
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-1">
                    {muted && <span className="text-red-400 text-xs">🔇</span>}
                    {videoOff && <span className="text-red-400 text-xs">📷</span>}

                    <span className="text-white text-xs font-medium truncate max-w-[120px]">
                        {name}
                        {isLocal && <span className="text-gray-400"> (Vous)</span>}
                        {isHost && <span className="text-yellow-400"> 👑</span>}
                    </span>
                </div>

                {handRaised && (
                    <span className="text-yellow-400 text-sm animate-bounce">✋</span>
                )}
            </div>

            {/* 📺 SCREEN SHARE BADGE */}
            {isScreenSharer && (
                <div className="absolute top-2 left-2 bg-green-500/95 text-white text-xs px-3 py-1.5 rounded-full font-bold animate-pulse flex items-center gap-1.5 shadow-lg shadow-green-900/40 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
                    Partage d'ecran
                </div>
            )}
        </div>
    );
}
