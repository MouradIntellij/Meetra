import { useEffect, useRef } from 'react';
import { useMedia }  from '../../context/MediaContext.jsx';
import { useRoom }   from '../../context/RoomContext.jsx';
import { useUI }     from '../../context/UIContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import VideoTile     from './VideoTile.jsx';

// ── Mini caméra locale (Picture-in-Picture) ───────────────────
function PipCamera({ stream, name, videoOff, muted }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;

        if (el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
        }

        return () => { el.srcObject = null; };
    }, [stream]);

    return (
        <div className="absolute bottom-4 right-4 w-44 h-28 z-20
      rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600
      bg-gray-800 flex items-center justify-center">
            {stream && !videoOff ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
            flex items-center justify-center text-white text-lg font-bold">
                        {name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-gray-300 text-xs">{name}</span>
                </div>
            )}

            <div className="absolute bottom-1 left-2 text-white text-[10px] font-medium
        bg-black/50 px-1.5 py-0.5 rounded">
                {muted ? '🔇' : '🎤'} Vous
            </div>
        </div>
    );
}

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

    const total = 1 + participants.length;

    const gridCols = () => {
        if (total === 1) return 'grid-cols-1';
        if (total === 2) return 'grid-cols-2';
        if (total <= 4)  return 'grid-cols-2';
        if (total <= 9)  return 'grid-cols-3';
        return 'grid-cols-4';
    };

    // ─────────────────────────────────────────────────────────────
    // 🎯 SCREEN SHARE MODE (Zoom-like focus system)
    // ─────────────────────────────────────────────────────────────
    if (screenStream) {
        return (
            <div className="relative w-full h-full bg-gray-950 flex flex-col">

                {/* Participants */}
                {participants.length > 0 ? (
                    <div className={`grid ${
                        participants.length === 1 ? 'grid-cols-1'
                            : participants.length <= 4 ? 'grid-cols-2'
                                : 'grid-cols-3'
                    } gap-1 p-2 flex-1 min-h-0 auto-rows-fr`}>

                        {participants.map(p => {

                            const stream = remoteStreams.get(p.socketId);

                            // 🔥 SCREEN SHARING PRIORITY (focus Zoom-like)
                            const isScreenSharer =
                                p.socketId === activeSpeakerId || p.isScreenSharing;

                            return (
                                <div
                                    key={p.socketId}
                                    className={`transition-all duration-200 ${
                                        isScreenSharer
                                            ? "ring-4 ring-green-400 shadow-[0_0_25px_rgba(0,255,100,0.8)] scale-[1.02]"
                                            : ""
                                    }`}
                                >
                                    <VideoTile
                                        stream={stream}
                                        name={p.name}
                                        isHost={p.socketId === hostId}
                                        muted={!p.audioEnabled}
                                        videoOff={!p.videoEnabled}
                                        handRaised={p.handRaised}
                                        isActive={isScreenSharer}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-3">
                            <div className="text-5xl">🖥️</div>
                            <p className="text-white font-semibold">Partage d'écran actif</p>
                            <p className="text-gray-400 text-sm">
                                Les autres participants verront votre écran en rejoignant.
                            </p>
                        </div>
                    </div>
                )}

                {/* PiP Camera */}
                <PipCamera
                    stream={localStream}
                    name="Vous"
                    videoOff={!videoEnabled}
                    muted={!audioEnabled}
                />

                {/* Badge */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2
          flex items-center gap-2 bg-red-600/90 text-white text-xs
          px-4 py-1.5 rounded-full shadow-lg pointer-events-none z-10">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block" />
                    Vous partagez votre écran
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // SPOTLIGHT MODE
    // ─────────────────────────────────────────────────────────────
    if (layout === 'spotlight') {

        const activePart =
            participants.find(p => p.socketId === activeSpeakerId);

        const rest =
            participants.filter(p => p.socketId !== activeSpeakerId);

        return (
            <div className="flex flex-col h-full gap-1 p-2">

                <div className="flex-1 min-h-0">
                    {activePart ? (
                        <VideoTile
                            stream={remoteStreams.get(activePart.socketId)}
                            name={activePart.name}
                            isActive
                            isHost={activePart.socketId === hostId}
                            muted={!activePart.audioEnabled}
                            videoOff={!activePart.videoEnabled}
                            handRaised={activePart.handRaised}
                            className="w-full h-full"
                        />
                    ) : (
                        <VideoTile
                            stream={localStream}
                            name="Vous"
                            isLocal
                            isActive
                            muted={!audioEnabled}
                            videoOff={!videoEnabled}
                            className="w-full h-full"
                        />
                    )}
                </div>

                <div className="flex gap-1 h-24 overflow-x-auto shrink-0">

                    {activeSpeakerId !== socket?.id && (
                        <VideoTile
                            stream={localStream}
                            name="Vous"
                            isLocal
                            muted={!audioEnabled}
                            videoOff={!videoEnabled}
                            className="w-36 h-full shrink-0"
                        />
                    )}

                    {rest.map(p => (
                        <VideoTile
                            key={p.socketId}
                            stream={remoteStreams.get(p.socketId)}
                            name={p.name}
                            isHost={p.socketId === hostId}
                            muted={!p.audioEnabled}
                            videoOff={!p.videoEnabled}
                            handRaised={p.handRaised}
                            className="w-36 h-full shrink-0"
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT GRID MODE
    // ─────────────────────────────────────────────────────────────
    return (
        <div className={`grid ${gridCols()} gap-1 p-2 h-full auto-rows-fr`}>

            <VideoTile
                stream={localStream}
                name="Vous"
                isLocal
                isActive={activeSpeakerId === socket?.id}
                isHost={socket?.id === hostId}
                muted={!audioEnabled}
                videoOff={!videoEnabled}
            />

            {participants.map(p => {

                const stream = remoteStreams.get(p.socketId);

                const isActive = activeSpeakerId === p.socketId;

                return (
                    <div
                        key={p.socketId}
                        className={isActive
                            ? "ring-4 ring-green-400 shadow-[0_0_25px_rgba(0,255,100,0.6)] rounded-xl"
                            : ""
                        }
                    >
                        <VideoTile
                            stream={stream}
                            name={p.name}
                            isActive={isActive}
                            isHost={p.socketId === hostId}
                            muted={!p.audioEnabled}
                            videoOff={!p.videoEnabled}
                            handRaised={p.handRaised}
                        />
                    </div>
                );
            })}
        </div>
    );
}