import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { EVENTS } from '../../utils/events.js';

// ─── Réactions "Send with effect" ───────────────────────
const EFFECT_REACTIONS = [
    { emoji: '🎈', label: 'Ballons' },
    { emoji: '🚀', label: 'Fusée' },
    { emoji: '👍', label: 'Super' },
    { emoji: '😂', label: 'Haha' },
    { emoji: '🎉', label: 'Confetti' },
    { emoji: '❤️', label: 'Love' },
];

// ─── Réactions rapides ──────────────────────────────────
const QUICK_REACTIONS = [
    { emoji: '👋', label: 'Salut' },
    { emoji: '👍', label: 'Super' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Haha' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '🎉', label: 'Fête' },
];

// ─── Statuts ────────────────────────────────────────────
const STATUS_BUTTONS = [
    { emoji: '✅', label: 'Oui', key: 'yes' },
    { emoji: '❌', label: 'Non', key: 'no' },
    { emoji: '⏪', label: 'Plus lent', key: 'slow' },
    { emoji: '⏩', label: 'Plus vite', key: 'fast' },
    { emoji: '☕', label: 'Pause', key: 'break' },
];

export default function ReactionBar({
                                        roomId,
                                        userName,
                                        toggleHand,
                                        handRaised
                                    }) {

    const { socket } = useSocket();
    const { addReaction } = useUI();

    const [open, setOpen] = useState(false);
    const [brbActive, setBrbActive] = useState(false);

    const panelRef = useRef(null);

    // ── clic extérieur ─────────────────────────────────────
    useEffect(() => {
        if (!open) return;

        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // ── écoute des réactions serveur ───────────────────────
    useEffect(() => {
        if (!socket) return;

        const handler = (reaction) => addReaction(reaction);

        socket.off(EVENTS.REACTION_BROADCAST, handler); // 🔥 important
        socket.on(EVENTS.REACTION_BROADCAST, handler);

        return () => {
            socket.off(EVENTS.REACTION_BROADCAST, handler);
        };
    }, [socket, addReaction]);

    // ── envoyer réaction ───────────────────────────────────
    const send = (emoji, isEffect = false) => {
        if (!socket) return;

        socket.emit(EVENTS.REACTION, {
            roomId,
            emoji,
            isEffect,
            userName: userName || 'Moi',
        });

        setOpen(false);
    };

    // ── main levée ─────────────────────────────────────────
    const handleRaiseHand = () => {
        if (toggleHand) toggleHand();
        setOpen(false);
    };

    // ── BRB ────────────────────────────────────────────────
    const handleBrb = () => {
        setBrbActive(v => !v);
        send(brbActive ? '👋' : '⏳');
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative' }} ref={panelRef}>

            {/* ── bouton principal ── */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '8px 14px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: open
                        ? 'rgba(245,158,11,0.2)'
                        : 'rgba(255,255,255,0.07)',
                    color: open ? '#fbbf24' : 'rgba(255,255,255,0.75)',
                    minWidth: 64,
                }}
            >
        <span style={{ fontSize: 20 }}>
          {handRaised ? '✋' : '😀'}
        </span>
                <span style={{ fontSize: 10 }}>
          {handRaised ? 'Main levée' : 'Réagir'}
        </span>
            </button>

            {/* ── panel ── */}
            {open && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 10px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1e2433',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 16,
                        padding: 14,
                        width: 280,
                        zIndex: 100,
                    }}
                >

                    {/* EFFECT */}
                    <p style={{ fontSize: 11, opacity: 0.5 }}>Send with effect</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>
                        {EFFECT_REACTIONS.map(r => (
                            <button key={r.emoji} onClick={() => send(r.emoji, true)}>
                                {r.emoji}
                            </button>
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

                    {/* QUICK */}
                    <p style={{ fontSize: 11, opacity: 0.5 }}>Reactions</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>
                        {QUICK_REACTIONS.map(r => (
                            <button key={r.emoji} onClick={() => send(r.emoji, false)}>
                                {r.emoji}
                            </button>
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

                    {/* STATUS */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {STATUS_BUTTONS.map(r => (
                            <button key={r.key} onClick={() => send(r.emoji, false)}>
                                {r.emoji}
                            </button>
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

                    {/* HAND */}
                    <button onClick={handleRaiseHand}>
                        {handRaised ? 'Baisser la main' : 'Lever la main'}
                    </button>

                    {/* BRB */}
                    <button onClick={handleBrb}>
                        {brbActive ? 'Je suis de retour' : 'Be right back'}
                    </button>

                </div>
            )}
        </div>
    );
}