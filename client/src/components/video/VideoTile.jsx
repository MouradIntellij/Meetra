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
    const [isFocused, setIsFocused] = useState(false);

    // 🎥 attach stream
    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;

        // 🔥 IMPORTANT: reset transform (ANTI MIRROR ROOT FIX)
        el.style.transform = 'none';

        el.srcObject = stream;
        el.play().catch(() => {});

        return () => {
            el.srcObject = null;
        };
    }, [stream]);

    // 🟢 screen share detection
    const isScreenSharer = screenSharingId === socketId;

    // 🎯 auto focus
    useEffect(() => {
        if (!containerRef.current) return;

        if (isScreenSharer) {
            containerRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
            });
            setIsFocused(true);
        } else {
            setIsFocused(false);
        }
    }, [isScreenSharer]);

    return (
        <div
            ref={containerRef}
            className={`
        relative bg-gray-800 rounded-xl overflow-hidden
        flex items-center justify-center
        transition-all duration-300

        ${isActive ? 'ring-2 ring-green-400' : ''}

        ${isScreenSharer
                ? 'ring-4 ring-green-500 shadow-[0_0_25px_rgba(34,197,94,0.7)] scale-[1.02]'
                : ''}

        ${isFocused ? 'z-50' : ''}

        ${className}
      `}
        >
            {/* 🎥 VIDEO */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`
          w-full h-full object-cover
          ${stream && !videoOff ? 'block' : 'hidden'}

          /* 🔥 HARD FIX ANTI MIRROR */
          !transform-none
        `}
                style={{
                    transform: 'none', // 🔥 force override CSS global
                }}
            />

            {/* 👤 AVATAR */}
            {(!stream || videoOff) && (
                <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
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
                <div className="absolute top-2 left-2 bg-green-500 text-black text-xs px-2 py-1 rounded-md font-bold animate-pulse">
                    📺 Screen sharing
                </div>
            )}
        </div>
    );
}