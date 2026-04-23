import { useEffect, useRef } from 'react';
import { useMedia }  from '../../context/MediaContext.jsx';
import { useRoom }   from '../../context/RoomContext.jsx';
import { useUI }     from '../../context/UIContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import VideoTile     from './VideoTile.jsx';

// ─────────────────────────────────────────────
// PiP CAMERA (toujours visible en Zoom mode)
// ─────────────────────────────────────────────
function PipCamera({ stream, name }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;
        el.srcObject = stream;
        el.play().catch(() => {});
    }, [stream]);

    return (
        <div className="absolute bottom-4 right-4 w-48 h-32 z-50
      rounded-xl overflow-hidden border-2 border-gray-500 shadow-xl bg-black">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-2 text-white text-xs bg-black/60 px-2 rounded">
                Vous
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
    const { activeSpeakerId } = useUI();
    const { socket } = useSocket();

    // ─────────────────────────────────────────────
    // 🎯 ZOOM MODE (SCREEN SHARE ACTIVE)
    // ─────────────────────────────────────────────
    if (screenStream) {
        const screenSharer = participants.find(
            p => p.socketId === activeSpeakerId || p.isScreenSharing
        );

        return (
            <div className="relative w-full h-full bg-black flex">

                {/* ───── MAIN SCREEN ───── */}
                <div className="flex-1 bg-black flex items-center justify-center">
                    <VideoTile
                        stream={screenStream}
                        name="Screen Share"
                        isActive
                        className="w-full h-full"
                    />
                </div>

                {/* ───── RIGHT SIDEBAR (participants) ───── */}
                <div className="w-64 bg-gray-900 flex flex-col gap-2 p-2 overflow-y-auto">

                    {/* local user */}
                    <VideoTile
                        stream={localStream}
                        name="Vous"
                        isLocal
                        muted={!audioEnabled}
                        videoOff={!videoEnabled}
                        className="h-28"
                    />

                    {/* others */}
                    {participants.map(p => (
                        <VideoTile
                            key={p.socketId}
                            stream={remoteStreams.get(p.socketId)}
                            name={p.name}
                            isHost={p.socketId === hostId}
                            muted={!p.audioEnabled}
                            videoOff={!p.videoEnabled}
                            className="h-28"
                        />
                    ))}
                </div>

                {/* ───── PiP CAMERA ───── */}
                <PipCamera
                    stream={localStream}
                    name="Vous"
                />

                {/* ───── TOP BAR ───── */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2
          bg-red-600 text-white px-4 py-1 rounded-full text-xs">
                    🔴 Screen sharing active (Zoom mode)
                </div>

            </div>
        );
    }

    // ─────────────────────────────────────────────
    // DEFAULT GRID MODE
    // ─────────────────────────────────────────────
    const gridCols = participants.length > 4 ? 'grid-cols-3' : 'grid-cols-2';

    return (
        <div className={`grid ${gridCols} gap-2 p-2 h-full`}>

            <VideoTile
                stream={localStream}
                name="Vous"
                isLocal
                isActive={activeSpeakerId === socket?.id}
                muted={!audioEnabled}
                videoOff={!videoEnabled}
            />

            {participants.map(p => (
                <VideoTile
                    key={p.socketId}
                    stream={remoteStreams.get(p.socketId)}
                    name={p.name}
                    isActive={activeSpeakerId === p.socketId}
                    muted={!p.audioEnabled}
                    videoOff={!p.videoEnabled}
                />
            ))}

        </div>
    );
}