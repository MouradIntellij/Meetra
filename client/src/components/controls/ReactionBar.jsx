import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { EVENTS } from '../../utils/events.js';
import { HandIcon, SparkIcon } from '../common/AppIcons.jsx';

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

function EmojiButton({ emoji, label, onClick, tone = 'default' }) {
    const toneStyles = {
        default: {
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f8fafc',
        },
        warm: {
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.18)',
            color: '#fde68a',
        },
        cool: {
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(96,165,250,0.18)',
            color: '#dbeafe',
        },
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            style={{
                ...toneStyles,
                borderRadius: 14,
                minHeight: 62,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, filter 0.15s ease, background 0.15s ease',
                fontFamily: 'inherit',
                padding: '8px 4px',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.filter = 'brightness(1.12)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.filter = 'none';
            }}
        >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{label}</span>
        </button>
    );
}

function ActionButton({ label, onClick, active = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                width: '100%',
                borderRadius: 14,
                border: `1px solid ${active ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.1)'}`,
                background: active ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.05)',
                color: active ? '#fde68a' : '#e2e8f0',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '10px 12px',
                fontFamily: 'inherit',
                textAlign: 'left',
            }}
        >
            {label}
        </button>
    );
}

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
    const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });

    const panelRef = useRef(null);
    const buttonRef = useRef(null);

    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;

        const updatePosition = () => {
            const rect = buttonRef.current.getBoundingClientRect();
            const width = 320;
            const viewportPadding = 16;
            const centeredLeft = rect.left + (rect.width / 2) - (width / 2);
            const left = Math.min(
                Math.max(centeredLeft, viewportPadding),
                window.innerWidth - width - viewportPadding
            );

            setPanelPosition({
                left,
                top: rect.top - 14,
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

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
                ref={buttonRef}
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
                <span style={{ display: 'inline-flex' }}>
          {handRaised ? <HandIcon size={18} color="currentColor" /> : <SparkIcon size={18} color="currentColor" />}
        </span>
                <span style={{ fontSize: 10 }}>
          {handRaised ? 'Main levée' : 'Réagir'}
        </span>
            </button>

            {/* ── panel ── */}
            {open && createPortal(
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        left: panelPosition.left,
                        top: panelPosition.top,
                        transform: 'translateY(-100%)',
                        background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 22,
                        padding: 16,
                        width: 320,
                        zIndex: 1400,
                        boxShadow: '0 30px 70px rgba(2,6,23,0.48)',
                        backdropFilter: 'blur(18px)',
                    }}
                >

                    {/* EFFECT */}
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.86)' }}>Effets</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {EFFECT_REACTIONS.map(r => (
                            <EmojiButton key={r.emoji} emoji={r.emoji} label={r.label} tone="warm" onClick={() => send(r.emoji, true)} />
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '14px 0' }} />

                    {/* QUICK */}
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(191,219,254,0.86)' }}>Réactions</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {QUICK_REACTIONS.map(r => (
                            <EmojiButton key={r.emoji} emoji={r.emoji} label={r.label} tone="cool" onClick={() => send(r.emoji, false)} />
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '14px 0' }} />

                    {/* STATUS */}
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.74)' }}>Statuts</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {STATUS_BUTTONS.map(r => (
                            <EmojiButton key={r.key} emoji={r.emoji} label={r.label} onClick={() => send(r.emoji, false)} />
                        ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '14px 0' }} />

                    <div style={{ display: 'grid', gap: 8 }}>
                        <ActionButton onClick={handleRaiseHand} active={handRaised} label={handRaised ? 'Baisser la main' : 'Lever la main'} />
                        <ActionButton onClick={handleBrb} active={brbActive} label={brbActive ? 'Je suis de retour' : 'Be right back'} />
                    </div>

                </div>
            , document.body)}
        </div>
    );
}
