import { useState, useRef, useEffect, useCallback } from 'react';
import { useMedia } from '../../context/MediaContext.jsx';
import { useRoom } from '../../context/RoomContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { useTranscription } from '../../context/TranscriptionContext.jsx';
import { useRecording } from '../../hooks/useRecording.js';
import { useVirtualBackground } from '../../hooks/useVirtualBackground.js';
import { platform } from '../../services/platform/index.js';
import ReactionBar from './ReactionBar.jsx';
import ScreenShareSelector from './ScreenShareSelector.jsx';
import VirtualBackground from '../layout/VirtualBackground.jsx';
import SettingsPanel from './SettingsPanel.jsx';

// ══════════════════════════════════════════════════════════════
//  ICÔNES SVG
// ══════════════════════════════════════════════════════════════
const I = {
    MicOn: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>),
    MicOff:()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>),
    CamOn: ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>),
    CamOff:()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/><path d="M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>),
    Share: ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M9 10l3-3 3 3M12 7v6"/></svg>),
    Rec:   ()=>(<svg viewBox="0 0 24 24" className="w-7 h-7"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>),
    Stop:  ()=>(<svg viewBox="0 0 24 24" className="w-7 h-7"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8"/><rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor"/></svg>),
    Grid:  ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>),
    Focus: ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="2" y="3" width="20" height="13" rx="1"/><path d="M2 17h5v4H2zM10 17h4v4h-4zM17 17h5v4h-5z"/></svg>),
    Phone: ()=>(<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 1.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.26 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.17 1.3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.1 9.18"/><line x1="23" y1="1" x2="1" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>),
    Chat:  ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
    People:()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
    Board: ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>),
    CC:    ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M9 10.5c-.5-.8-1.2-1.2-2.1-1.2-1.7 0-2.9 1.4-2.9 3.2s1.2 3.2 2.9 3.2c.9 0 1.6-.4 2.1-1.2"/><path d="M18.5 10.5c-.5-.8-1.2-1.2-2.1-1.2-1.7 0-2.9 1.4-2.9 3.2s1.2 3.2 2.9 3.2c.9 0 1.6-.4 2.1-1.2"/></svg>),
    Hand:  ({ raised = false })=>(<svg viewBox="0 0 24 24" fill={raised ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M18 11V6a1 1 0 0 0-2 0v5"/><path d="M14 10V5a1 1 0 0 0-2 0v8"/><path d="M10 10.5V4a1 1 0 0 0-2 0v9"/><path d="M6 11V8a1 1 0 0 0-2 0v8a4 4 0 0 0 4 4h5a5 5 0 0 0 5-5v-4a1 1 0 0 0-2 0"/></svg>),
    Bg:    ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="8" cy="8" r="2"/><path d="M21 14l-5-5L8 17"/><line x1="2" y1="20" x2="22" y2="20"/></svg>),
    Gear:  ()=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>),
    X:     ()=>(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
    Check: ()=>(<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>),
    Upload:()=>(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
};

// ══════════════════════════════════════════════════════════════
//  DONNÉES FONDS PRÉDÉFINIS
// ══════════════════════════════════════════════════════════════
const BG_PRESETS = [
    { id:'office',    emoji:'🏢', label:'Bureau',    color:'#1e293b', url:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=75' },
    { id:'library',   emoji:'📚', label:'Biblio',    color:'#78350f', url:'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1280&q=75' },
    { id:'nature',    emoji:'🌲', label:'Forêt',     color:'#14532d', url:'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=75' },
    { id:'city',      emoji:'🌆', label:'Ville',     color:'#0f172a', url:'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&q=75' },
    { id:'beach',     emoji:'🏖️', label:'Plage',     color:'#1e40af', url:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=75' },
    { id:'space',     emoji:'🚀', label:'Espace',    color:'#020617', url:'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=75' },
    { id:'mountains', emoji:'🏔️', label:'Montagnes', color:'#1e3a5f', url:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=75' },
    { id:'studio',    emoji:'🎙️', label:'Studio',    color:'#1c1917', url:'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1280&q=75' },
];
const BG_COLORS = ['#0f172a','#1e3a5f','#14532d','#4c1d95','#831843','#1c1917','#312e81','#7c2d12'];

// ══════════════════════════════════════════════════════════════
//  MOTEUR BODYPIX (singleton chargé une seule fois)
// ══════════════════════════════════════════════════════════════
let bpNet = null, bpLoading = false;

async function ensureBodyPix(onMsg) {
    if (bpNet) return bpNet;
    if (bpLoading) {
        await new Promise(r => { const iv = setInterval(() => { if (bpNet || !bpLoading) { clearInterval(iv); r(); }}, 250); });
        return bpNet;
    }
    bpLoading = true;
    const loadScript = (src) => new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = src;
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    if (!window.tf) { onMsg?.('Chargement TensorFlow.js…'); await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js'); }
    if (!window.bodyPix) { onMsg?.('Chargement modèle BodyPix…'); await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.0/dist/body-pix.min.js'); }
    onMsg?.('Initialisation…');
    bpNet = await window.bodyPix.load({ architecture:'MobileNetV1', outputStride:16, multiplier:0.75, quantBytes:2 });
    bpLoading = false;
    return bpNet;
}

function compositePersonOnBg(ctx, videoEl, seg, W, H) {
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d'); tc.drawImage(videoEl, 0, 0, W, H);
    const id = tc.getImageData(0, 0, W, H), d = id.data, sd = seg.data, sw = seg.width, sh = seg.height;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const si = Math.floor(y * sh / H) * sw + Math.floor(x * sw / W);
        if (!sd[si]) d[(y * W + x) * 4 + 3] = 0;
    }
    tc.putImageData(id, 0, 0); ctx.drawImage(tmp, 0, 0);
}

function drawImageCover(ctx, img, W, H) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
}

// ══════════════════════════════════════════════════════════════
//  BOUTONS DE LA BARRE
// ══════════════════════════════════════════════════════════════
function ZoomBtn({ onClick, active, danger, highlight, title, icon, label, pulse }) {
    return (
        <button onClick={onClick} title={title} className={`meetra-focus-ring relative flex flex-col items-center justify-center gap-1.5 min-w-[56px] px-2 py-2.5 rounded-[18px] text-[9px] font-bold tracking-[0.16em] uppercase transition-all duration-200 select-none group backdrop-blur-xl ${danger?'bg-red-600/90 hover:bg-red-500 text-white shadow-[0_16px_35px_rgba(127,29,29,0.45)] border border-red-400/30':highlight?'bg-emerald-500/18 hover:bg-emerald-500/24 text-emerald-100 shadow-[0_18px_40px_rgba(34,197,94,0.2)] border border-emerald-400/25':active?'bg-slate-700/90 text-white ring-2 ring-white/20 border border-white/10':'bg-slate-900/82 hover:bg-slate-800/92 text-slate-300 hover:text-white border border-white/10 shadow-[0_12px_30px_rgba(2,6,23,0.3)]'} ${pulse?'ring-2 ring-offset-2 ring-offset-slate-950 ring-emerald-400/60':''}`}>
            <span className="transition-transform duration-150 group-hover:scale-110 group-active:scale-95">{icon}</span>
            <span className="leading-none whitespace-nowrap text-[9px]">{label}</span>
        </button>
    );
}

function MiniLeaveBtn({ onClick }) {
    return (
        <button
            onClick={onClick}
            title="Quitter la réunion"
            className="meetra-focus-ring flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/35 bg-red-600/90 text-white shadow-[0_18px_38px_rgba(127,29,29,0.45)] transition hover:bg-red-500"
        >
            <I.Phone />
        </button>
    );
}

function PanelBtn({ onClick, active, title, icon, label, badge = 0 }) {
    return (
        <button onClick={onClick} title={title} className={`meetra-focus-ring relative flex flex-col items-center justify-center gap-1 min-w-[54px] px-2 py-2.5 rounded-2xl text-[9px] font-bold tracking-[0.18em] uppercase transition-all duration-200 backdrop-blur-xl ${active?'bg-blue-500/20 text-blue-100 border border-blue-400/25 shadow-[0_14px_30px_rgba(59,130,246,0.2)]':'bg-slate-900/72 hover:bg-slate-800/90 text-slate-400 hover:text-white border border-white/10'}`}>
            {badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-slate-950 bg-red-500 px-1 text-[9px] font-extrabold text-white">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
            {icon}<span className="leading-none mt-0.5">{label}</span>
        </button>
    );
}

// ══════════════════════════════════════════════════════════════
//  EXPORT PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function ControlBar({ roomId, onLeave, toggleHand, handRaised, userName }) {
    const {
        audioEnabled,
        videoEnabled,
        toggleAudio,
        toggleVideo,
        localStream,
        peerConnections,
        isSharing,
        startScreenShare,
        stopScreenShare,
        screenShareMeta,
        setVirtualBackgroundStream,
    } = useMedia();
    const { locked } = useRoom();
    const { chatOpen, setChatOpen, chatUnread, participantsOpen, setParticipantsOpen, whiteboardOpen, setWhiteboardOpen, transcriptOpen, setTranscriptOpen, settingsOpen, setSettingsOpen, layout, toggleLayout } = useUI();
    const { isRecording, toggle: toggleRecording } = useRecording();
    const { captionsEnabled, setCaptionsEnabled, transcriptionActive, startTranscription, stopTranscription } = useTranscription();

    const [bgOpen, setBgOpen] = useState(false);
    const [bgActive, setBgActive] = useState(false);
    const [showScreenShareSelector, setShowScreenShareSelector] = useState(false);
    const virtualBackground = useVirtualBackground(
        localStream,
        peerConnections,
        setVirtualBackgroundStream
    );

    useEffect(() => {
        setBgActive(virtualBackground.active);
    }, [virtualBackground.active]);

    useEffect(() => {
        const unsubscribe = platform.onPresenterCommand?.((payload) => {
            if (!payload?.type) return;

            if (payload.type === 'stop-share') {
                stopScreenShare();
                return;
            }

            if (payload.type === 'change-source') {
                if (isSharing) {
                    stopScreenShare();
                }
                setShowScreenShareSelector(true);
            }
        });

        return () => unsubscribe?.();
    }, [isSharing, stopScreenShare]);

    const handleQuickScreenShare = async () => {
        if (platform.isElectron) {
            setShowScreenShareSelector(true);
            return;
        }

        await startScreenShare(null, {
            sound: false,
            presenterMode: true,
            optimize: 'detail',
            displaySurface: 'window',
        });
    };

    const handleScreenShare = async (stream, opts) => {
        setShowScreenShareSelector(false);
        if (!stream) return;
        await startScreenShare(stream, opts);
    };

    const handleTranscriptionToggle = () => {
        setTranscriptOpen(true);

        if (transcriptionActive) {
            setCaptionsEnabled(false);
            stopTranscription();
            return;
        }

        setCaptionsEnabled(true);
        startTranscription();
    };

    const handleLeaveMeeting = () => {
        const confirmed = window.confirm('Voulez-vous quitter la vidéoconférence Meetra ?');
        if (!confirmed) return;
        onLeave();
    };

    return (
        <>
            <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88)_0%,rgba(15,23,42,0.96)_100%)] px-4 py-3 shadow-[0_-18px_50px_rgba(2,6,23,0.45)] backdrop-blur-2xl" style={{ minHeight:'92px' }}>
                <div className="flex items-center justify-between gap-4">
                <div className="flex w-[52px] shrink-0 items-center justify-start">
                        <MiniLeaveBtn onClick={handleLeaveMeeting} />
                </div>

                <div className="flex min-w-0 flex-1 justify-center">
                <div className="mx-auto flex min-w-0 max-w-full items-center gap-2 overflow-x-auto rounded-[28px] border border-white/10 bg-white/[0.03] px-3 py-2 shadow-[0_20px_50px_rgba(2,6,23,0.25)]">
                    <ZoomBtn onClick={toggleAudio} active={!audioEnabled} icon={audioEnabled?<I.MicOn/>:<I.MicOff/>} label={audioEnabled?'Micro':'Muet'} title={audioEnabled?'Couper le micro':'Activer le micro'}/>
                    <ZoomBtn onClick={toggleVideo} active={!videoEnabled} icon={videoEnabled?<I.CamOn/>:<I.CamOff/>} label={videoEnabled?'Caméra':'Cam off'} title={videoEnabled?'Couper la caméra':'Activer la caméra'}/>

                    {/* ✅ BOUTON FOND VIRTUEL */}
                    <ZoomBtn
                        onClick={() => setBgOpen(o => !o)}
                        active={bgOpen && !bgActive}
                        highlight={bgActive}
                        pulse={bgActive}
                        icon={<I.Bg/>}
                        label={bgActive ? 'Fond on' : 'Fond'}
                        title="Arrière-plan virtuel"
                    />

                    {/* ✅ BOUTON PARTAGE D'ÉCRAN */}
                    <ZoomBtn
                        onClick={() => isSharing ? stopScreenShare() : handleQuickScreenShare()}
                        highlight={isSharing}
                        pulse={isSharing}
                        icon={<I.Share/>}
                        label={isSharing ? 'Partage' : 'Partager'}
                        title="Partager une application"
                    />

                    <ZoomBtn onClick={toggleRecording} active={isRecording} icon={isRecording?<I.Stop/>:<I.Rec/>} label={isRecording?'Stop Rec':'Enregistrer'} title={isRecording?"Arrêter l'enregistrement":"Démarrer l'enregistrement"}/>
                    <ZoomBtn
                        onClick={handleTranscriptionToggle}
                        active={captionsEnabled && !transcriptionActive}
                        highlight={transcriptionActive}
                        pulse={transcriptionActive}
                        icon={<I.CC/>}
                        label={transcriptionActive ? 'CC on' : captionsEnabled ? 'CC prêt' : 'Sous-titres'}
                        title="Sous-titres et transcription"
                    />
                    <ZoomBtn
                        onClick={toggleHand}
                        active={handRaised}
                        highlight={handRaised}
                        pulse={handRaised}
                        icon={<I.Hand raised={handRaised} />}
                        label={handRaised ? 'Main levée' : 'Lever main'}
                        title={handRaised ? 'Baisser la main' : 'Lever la main'}
                    />
                    <ReactionBar roomId={roomId} userName={userName} toggleHand={toggleHand} handRaised={handRaised}/>
                    <ZoomBtn onClick={toggleLayout} icon={layout==='grid'?<I.Grid/>:<I.Focus/>} label={layout==='grid'?'Grille':'Focus'} title="Changer la disposition"/>
                </div>
                </div>

                <div className="flex w-[340px] shrink-0 items-center justify-end gap-2">
                    {locked && (<span className="hidden 2xl:flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Réunion verrouillée</span>)}
                    {isSharing && (<button onClick={stopScreenShare} className="meetra-focus-ring hidden 2xl:flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/15 px-3.5 py-2 text-[11px] font-bold text-red-100 shadow-[0_12px_25px_rgba(127,29,29,0.28)] backdrop-blur-xl transition hover:bg-red-500/22"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>Arrêter le partage</button>)}
                    {!isSharing && (
                        <button
                            onClick={() => setShowScreenShareSelector(true)}
                            className="meetra-focus-ring hidden 2xl:flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                            title="Choix avance de la source"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <path d="M8 21h8M12 17v4" />
                                <path d="M9 10l3-3 3 3M12 7v6" />
                            </svg>
                            Source
                        </button>
                    )}
                    <PanelBtn onClick={()=>setParticipantsOpen(o=>!o)} active={participantsOpen} icon={<I.People/>} label="Participants"/>
                    <PanelBtn onClick={()=>setChatOpen(o=>!o)} active={chatOpen} icon={<I.Chat/>} label="Chat" badge={chatUnread}/>
                    <PanelBtn onClick={()=>setTranscriptOpen(o=>!o)} active={transcriptOpen} icon={<I.CC/>} label="Transcript"/>
                    <PanelBtn onClick={()=>setWhiteboardOpen(o=>!o)} active={whiteboardOpen} icon={<I.Board/>} label="Tableau"/>
                    <PanelBtn onClick={()=>setSettingsOpen(o=>!o)} active={settingsOpen} icon={<I.Gear/>} label="Paramètres"/>
                </div>
                </div>
            </div>

            {/* Panneau fond virtuel — s'ouvre AU-DESSUS de la barre */}
            {localStream && (
                bgOpen && (
                    <VirtualBackground
                        onClose={() => setBgOpen(false)}
                        controller={virtualBackground}
                    />
                )
            )}

            {/* Sélecteur de partage d'écran */}
            {showScreenShareSelector && (
                <ScreenShareSelector
                    onSelect={handleScreenShare}
                    onCancel={() => setShowScreenShareSelector(false)}
                    activeShare={screenShareMeta}
                />
            )}

            <SettingsPanel />
        </>
    );
}
