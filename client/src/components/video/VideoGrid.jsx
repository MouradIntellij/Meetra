import { useEffect, useRef, useState } from 'react';
import { useMedia } from '../../context/MediaContext.jsx';
import { useRoom } from '../../context/RoomContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { platform } from '../../services/platform/index.js';
import VideoTile from './VideoTile.jsx';

// ─── VideoPlayer (Composant réutilisable pour les flux vidéo) ──────
const VideoPlayer = ({ stream, muted, style, className }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !stream) return;
        el.srcObject = stream;
        el.style.transform = 'translateZ(0)';
        el.style.willChange = 'transform, opacity';
        el.style.opacity = '0.999';
        el.play().catch(() => {});
        return () => { el.srcObject = null; };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={{
                ...style,
                position: 'relative',
                zIndex: 0,
                transform: 'translateZ(0)',
                willChange: 'transform, opacity',
                opacity: 0.999,
                backfaceVisibility: 'hidden',
            }}
            className={className}
        />
    );
};

// ─── PipCamera (Mini-caméra flottante) ──────
const PipCamera = ({ stream, name, muted, videoOff }) => {
    const [hover, setHover] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [position, setPosition] = useState({ right: 20, bottom: 20 });
    const PIP_MARGIN = 16;
    const PIP_WIDTH = isExpanded ? 260 : 180;
    const PIP_HEIGHT = isExpanded ? 146 : 102;
    const dragState = useRef({
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
        startRight: 20,
        startBottom: 20,
    });

    useEffect(() => {
        setPosition((current) => ({
            right: Math.min(Math.max(current.right, PIP_MARGIN), Math.max(window.innerWidth - PIP_WIDTH - PIP_MARGIN, PIP_MARGIN)),
            bottom: Math.min(Math.max(current.bottom, PIP_MARGIN), Math.max(window.innerHeight - PIP_HEIGHT - PIP_MARGIN, PIP_MARGIN)),
        }));
    }, [PIP_WIDTH, PIP_HEIGHT]);

    useEffect(() => {
        const handlePointerMove = (event) => {
            if (!dragState.current.active) return;

            const deltaX = event.clientX - dragState.current.startX;
            const deltaY = event.clientY - dragState.current.startY;
            if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
                dragState.current.moved = true;
            }

            const nextRight = dragState.current.startRight - deltaX;
            const nextBottom = dragState.current.startBottom - deltaY;

            setPosition({
                right: Math.min(Math.max(nextRight, PIP_MARGIN), Math.max(window.innerWidth - PIP_WIDTH - PIP_MARGIN, PIP_MARGIN)),
                bottom: Math.min(Math.max(nextBottom, PIP_MARGIN), Math.max(window.innerHeight - PIP_HEIGHT - PIP_MARGIN, PIP_MARGIN)),
            });
        };

        const handlePointerUp = () => {
            if (!dragState.current.active) return;
            dragState.current.active = false;

            setPosition((current) => {
                const maxRight = Math.max(window.innerWidth - PIP_WIDTH - PIP_MARGIN, PIP_MARGIN);
                const maxBottom = Math.max(window.innerHeight - PIP_HEIGHT - PIP_MARGIN, PIP_MARGIN);

                return {
                    right: current.right < maxRight / 2 ? PIP_MARGIN : maxRight,
                    bottom: current.bottom < maxBottom / 2 ? PIP_MARGIN : maxBottom,
                };
            });
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

    const handleToggleSize = (event) => {
        event.stopPropagation();
        setIsExpanded((current) => !current);
    };

    const handleHide = (event) => {
        event.stopPropagation();
        setIsHidden(true);
    };

    const handleShow = () => {
        setIsHidden(false);
    };

    const handlePointerDown = (event) => {
        dragState.current = {
            active: true,
            moved: false,
            startX: event.clientX,
            startY: event.clientY,
            startRight: position.right,
            startBottom: position.bottom,
        };
    };

    if (isHidden) {
        return (
            <button
                type="button"
                onClick={handleShow}
                style={{
                    position: 'absolute',
                    right: position.right,
                    bottom: position.bottom,
                    zIndex: 100,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(2,6,23,0.82)',
                    color: '#e2e8f0',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    fontSize: 12,
                    fontWeight: 700,
                }}
                title="Afficher la vignette camera"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                    <rect x="3" y="6" width="13" height="12" rx="2" />
                    <path d="M16 10l5-3v10l-5-3" />
                </svg>
                Camera
            </button>
        );
    }

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onPointerDown={handlePointerDown}
            style={{
                position: 'absolute',
                bottom: position.bottom,
                right: position.right,
                width: PIP_WIDTH,
                height: PIP_HEIGHT,
                zIndex: 100,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid rgba(255, 255, 255, 0.25)',
                background: '#111',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                transition: dragState.current.active ? 'none' : 'transform 0.2s, opacity 0.2s',
                transform: hover ? 'scale(1.04)' : 'scale(1)',
                cursor: dragState.current.active ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
            }}
        >
            <button
                type="button"
                onClick={handleToggleSize}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 2,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(2,6,23,0.72)',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
                }}
                title={isExpanded ? 'Reduire la vignette' : 'Agrandir la vignette'}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    {isExpanded ? (
                        <>
                            <path d="M15 9h5V4" />
                            <path d="M9 15H4v5" />
                            <path d="M20 4l-6 6" />
                            <path d="M4 20l6-6" />
                        </>
                    ) : (
                        <>
                            <path d="M15 4h5v5" />
                            <path d="M9 20H4v-5" />
                            <path d="M20 9l-6-6" />
                            <path d="M4 15l6 6" />
                        </>
                    )}
                </svg>
            </button>

            <button
                type="button"
                onClick={handleHide}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 42,
                    zIndex: 2,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(2,6,23,0.72)',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
                }}
                title="Masquer la vignette"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M4 12h16" />
                </svg>
            </button>

            {!videoOff && stream ? (
                <VideoPlayer
                    stream={stream}
                    muted={muted}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: '#1a1f2e',
                }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                    }}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                </div>
            )}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.85))',
                padding: isExpanded ? '10px 8px 6px' : '8px 6px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
            }}>
                {muted && <span style={{ color: '#f87171', fontSize: 9 }}>🔇</span>}
                <span style={{ fontSize: isExpanded ? 11 : 10, color: '#e2e8f0', fontWeight: 600 }}>
                    Vous
                </span>
            </div>
        </div>
    );
};

// ─── FilmstripTile (Vignette de participant) ──────
const FilmstripTile = ({ stream, name, isLocal, isHost, muted, videoOff, handRaised, isActive }) => {
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
            {!videoOff && stream ? (
                <VideoPlayer
                    stream={stream}
                    muted={true}
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
                <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
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
};

const formatElapsed = (startedAt) => {
    if (!startedAt) return '00:00';
    const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── ScreenShareFullscreen (Affichage plein écran du partage) ──────
const ScreenShareFullscreen = ({ screenStream, localStream, participants, remoteStreams, hostId, audioEnabled, videoEnabled, activeSpeakerId }) => {
    const [controlsVisible, setControlsVisible] = useState(true);
    const [elapsed, setElapsed] = useState(() => formatElapsed(null));
    const [hideRecursivePreview, setHideRecursivePreview] = useState(false);
    const [shouldSuggestAntiMirror, setShouldSuggestAntiMirror] = useState(false);
    const { screenShareMeta, stopScreenShare } = useMedia();
    const isEntireScreenShare = screenShareMeta?.displaySurface === 'monitor';
    const isWindowShare = screenShareMeta?.displaySurface === 'window';
    const showLocalShareBanner = !platform.isElectron;

    useEffect(() => {
        setElapsed(formatElapsed(screenShareMeta?.startedAt));
        if (!screenShareMeta?.startedAt) return;

        const id = setInterval(() => {
            setElapsed(formatElapsed(screenShareMeta.startedAt));
        }, 1000);

        return () => clearInterval(id);
    }, [screenShareMeta?.startedAt]);

    useEffect(() => {
        setHideRecursivePreview(false);
    }, [screenStream, screenShareMeta?.displaySurface]);

    useEffect(() => {
        if (!isEntireScreenShare) {
            setShouldSuggestAntiMirror(false);
            return;
        }

        const updateMirrorRisk = () => {
            const pageVisible = document.visibilityState === 'visible';
            const pageFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
            setShouldSuggestAntiMirror(pageVisible && pageFocused);
        };

        updateMirrorRisk();

        window.addEventListener('focus', updateMirrorRisk);
        window.addEventListener('blur', updateMirrorRisk);
        document.addEventListener('visibilitychange', updateMirrorRisk);

        return () => {
            window.removeEventListener('focus', updateMirrorRisk);
            window.removeEventListener('blur', updateMirrorRisk);
            document.removeEventListener('visibilitychange', updateMirrorRisk);
        };
    }, [isEntireScreenShare]);

    // Masquer les contrôles après 3 secondes d'inactivité
    useEffect(() => {
        let timer;
        const handleMouseMove = () => {
            setControlsVisible(true);
            clearTimeout(timer);
            timer = setTimeout(() => setControlsVisible(false), 3000);
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#0a0a0f',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Main screen area */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                outline: isWindowShare ? 'none' : '3px solid #22c55e',
                outlineOffset: isWindowShare ? '0' : '-3px',
            }}>
                {isWindowShare ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
                    }} />
                ) : hideRecursivePreview ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        background: 'radial-gradient(circle at top, rgba(34,197,94,0.14), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
                    }}>
                        <div style={{
                            maxWidth: 720,
                            width: '100%',
                            borderRadius: 24,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(2,6,23,0.82)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
                            padding: '30px 32px',
                            color: '#e2e8f0',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                width: 72,
                                height: 72,
                                margin: '0 auto 18px',
                                borderRadius: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(34,197,94,0.12)',
                                border: '1px solid rgba(34,197,94,0.25)',
                                boxShadow: '0 16px 40px rgba(34,197,94,0.18)',
                                fontSize: 32,
                            }}>
                                🖥
                            </div>
                            <h3 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>
                                Partage plein ecran en cours
                            </h3>
                            <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.6, color: 'rgba(226,232,240,0.78)' }}>
                                L’aperçu local du partage est masqué pour éviter l’effet miroir infini.
                                Les autres participants voient toujours votre écran partagé normalement.
                            </p>
                            <p style={{ margin: '0 0 22px', fontSize: 13, lineHeight: 1.6, color: 'rgba(148,163,184,0.92)' }}>
                                Pour un résultat plus propre, partagez plutôt une application précise, ou déplacez cette fenêtre sur un autre écran.
                            </p>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                                flexWrap: 'wrap',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setHideRecursivePreview(false)}
                                    style={{
                                        border: '1px solid rgba(255,255,255,0.14)',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: '#e2e8f0',
                                        borderRadius: 14,
                                        padding: '11px 16px',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Revenir a l’aperçu
                                </button>
                                <button
                                    type="button"
                                    onClick={stopScreenShare}
                                    style={{
                                        border: '1px solid rgba(248,113,113,0.35)',
                                        background: 'rgba(127,29,29,0.75)',
                                        color: '#fee2e2',
                                        borderRadius: 14,
                                        padding: '11px 16px',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Arreter le partage
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <VideoPlayer
                        stream={screenStream}
                        muted={true}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                            background: '#000',
                        }}
                    />
                )}

                {isEntireScreenShare && shouldSuggestAntiMirror && !hideRecursivePreview && (
                    <button
                        type="button"
                        onClick={() => setHideRecursivePreview(true)}
                        style={{
                            position: 'absolute',
                            right: 18,
                            bottom: 18,
                            zIndex: 15,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'rgba(2,6,23,0.74)',
                            color: '#e2e8f0',
                            borderRadius: 14,
                            padding: '10px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
                        }}
                    >
                        Masquer l’aperçu anti-miroir
                    </button>
                )}

                {/* Mini-caméra flottante */}
                {screenShareMeta?.options?.presenterMode !== false && (
                    <PipCamera
                        stream={localStream}
                        name="Vous"
                        muted={!audioEnabled}
                        videoOff={!videoEnabled}
                    />
                )}

                {/* Indicateur de partage d'écran */}
                {showLocalShareBanner && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: 18,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(4,10,25,0.82)',
                            color: '#fff',
                            borderRadius: 24,
                            padding: '12px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            boxShadow: '0 18px 50px rgba(0,0,0,0.38)',
                            backdropFilter: 'blur(18px)',
                            zIndex: 12,
                            transition: 'opacity 0.3s',
                            opacity: controlsVisible ? 1 : 0,
                            border: '1px solid rgba(34,197,94,0.35)',
                            minWidth: 520,
                            maxWidth: 'calc(100% - 32px)',
                        }}>
                            <span style={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                background: '#22c55e',
                                boxShadow: '0 0 0 4px rgba(34,197,94,0.18)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 3, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>Vous partagez votre ecran</span>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 999,
                                        padding: '2px 8px',
                                        background: 'rgba(34,197,94,0.14)',
                                        color: '#bbf7d0',
                                        fontSize: 11,
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {elapsed}
                                    </span>
                                </div>
                                {screenShareMeta?.label && (
                                    <span style={{
                                        maxWidth: 340,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: 'rgba(255,255,255,0.72)',
                                        fontWeight: 600,
                                    }}>
                                        {screenShareMeta.label}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={stopScreenShare}
                                style={{
                                    border: '1px solid rgba(248,113,113,0.35)',
                                    background: 'rgba(127,29,29,0.75)',
                                    color: '#fee2e2',
                                    borderRadius: 14,
                                    padding: '10px 14px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Arreter le partage
                            </button>
                        </div>

                        <div style={{
                            position: 'absolute',
                            left: 16,
                            top: 96,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            zIndex: 9,
                            transition: 'opacity 0.3s',
                            opacity: controlsVisible ? 1 : 0,
                        }}>
                            <div style={{
                                background: 'rgba(34,197,94,0.14)',
                                color: '#dcfce7',
                                border: '1px solid rgba(34,197,94,0.28)',
                                borderRadius: 999,
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                backdropFilter: 'blur(10px)',
                            }}>
                                Bordure verte active
                            </div>
                            {screenShareMeta?.displaySurface && (
                                <div style={{
                                    background: 'rgba(15,23,42,0.7)',
                                    color: 'rgba(255,255,255,0.8)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 14,
                                    padding: '8px 12px',
                                    fontSize: 12,
                                    backdropFilter: 'blur(10px)',
                                }}>
                                    Source: {screenShareMeta.displaySurface === 'window' ? 'Application' : screenShareMeta.displaySurface === 'browser' ? 'Onglet navigateur' : 'Plein ecran'}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom filmstrip: participants */}
            <div style={{
                height: 126,
                background: 'linear-gradient(180deg, rgba(2,6,23,0.82) 0%, rgba(2,6,23,0.96) 100%)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px 12px',
                flexShrink: 0,
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '0 2px',
                }}>
                    <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.46)',
                    }}>
                        Participants visibles
                    </div>
                    <div style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.65)',
                    }}>
                        {participants.length + 1} en reunion
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    overflowX: 'auto',
                    paddingBottom: 2,
                }}>
                    <FilmstripTile
                        stream={localStream}
                        name="Vous"
                        isLocal
                        muted={!audioEnabled}
                        videoOff={!videoEnabled}
                        isActive={false}
                    />

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
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

// ─── Main VideoGrid component ─────────────────────────────────
export default function VideoGrid() {
    const {
        localStream,
        displayLocalStream,
        remoteStreams,
        audioEnabled,
        videoEnabled,
        screenStream,
        screenShareMeta,
    } = useMedia();

    const { participants, hostId } = useRoom();
    const { activeSpeakerId, layout } = useUI();
    const { socket } = useSocket();
    const isElectronWindowShare = platform.isElectron && screenShareMeta?.displaySurface === 'window';

    // Screen share mode
    if (screenStream && !isElectronWindowShare) {
        return (
            <ScreenShareFullscreen
                screenStream={screenStream}
                localStream={displayLocalStream}
                participants={participants}
                remoteStreams={remoteStreams}
                hostId={hostId}
                audioEnabled={audioEnabled}
                videoEnabled={videoEnabled}
                activeSpeakerId={activeSpeakerId}
                screenShareMeta={screenShareMeta}
            />
        );
    }

    // Spotlight mode
    if (layout === 'spotlight' && (participants.length > 0 || activeSpeakerId)) {
        const spotlightId = activeSpeakerId || participants[0]?.socketId;
        const spotlightP = participants.find(p => p.socketId === spotlightId);
        const isLocalSpotlight = !spotlightP;
        const spotlightStream = isLocalSpotlight ? displayLocalStream : remoteStreams.get(spotlightId);
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
                            stream={displayLocalStream}
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

    // Default grid mode
    const totalCount = participants.length + 1; // +1 for local
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
                stream={displayLocalStream}
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
