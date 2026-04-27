/**
 * VirtualBackground.jsx
 *
 * Panneau de sélection d'arrière-plan virtuel style Zoom/Teams.
 *
 * Props :
 *   localStream      MediaStream   — flux caméra local
 *   peerConnections  React.ref     — Map<socketId, RTCPeerConnection>
 *   onClose          () => void    — fermer le panneau
 *
 * Modes :
 *   Aucun (vidéo normale)
 *   Flou  (intensité réglable)
 *   Image prédéfinie (8 choix)
 *   Couleur unie
 *   Upload custom
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import ModalFrame from '../common/ModalFrame.jsx';

// ─── Images prédéfinies ───────────────────────────────────────
// URLs libres de droits depuis Unsplash (CDN autorisé via fetch)
const PRESET_BACKGROUNDS = [
    {
        id: 'office1',
        label: 'Bureau moderne',
        emoji: '🏢',
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80',
        color: '#2d3748',
    },
    {
        id: 'library',
        label: 'Bibliothèque',
        emoji: '📚',
        url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1280&q=80',
        color: '#744210',
    },
    {
        id: 'nature',
        label: 'Forêt',
        emoji: '🌲',
        url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=80',
        color: '#276749',
    },
    {
        id: 'city',
        label: 'Ville la nuit',
        emoji: '🌆',
        url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&q=80',
        color: '#2b2d42',
    },
    {
        id: 'beach',
        label: 'Plage',
        emoji: '🏖️',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80',
        color: '#2b6cb0',
    },
    {
        id: 'space',
        label: 'Espace',
        emoji: '🚀',
        url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80',
        color: '#1a202c',
    },
    {
        id: 'studio',
        label: 'Studio pro',
        emoji: '🎙️',
        url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1280&q=80',
        color: '#1a1a2e',
    },
    {
        id: 'mountains',
        label: 'Montagnes',
        emoji: '🏔️',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=80',
        color: '#2c5282',
    },
];

// Couleurs solides prédéfinies
const PRESET_COLORS = [
    '#1a1f36', '#0f2744', '#064e3b', '#3b1f2b',
    '#1c1917', '#312e81', '#7c3aed', '#be185d',
];

// ─── Icônes SVG inline ────────────────────────────────────────
const BlurIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
);
const ImageIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>
);
const UploadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 16 12 12 8 16"/>
        <line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
);
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);
const SpinnerIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
    </svg>
);

// ─── Preview thumbnail ────────────────────────────────────────
function BgThumb({ bg, selected, onClick, loading }) {
    const [imgLoaded, setImgLoaded] = useState(false);

    return (
        <button
            onClick={onClick}
            style={{
                position: 'relative',
                width: '100%', aspectRatio: '16/9',
                borderRadius: 10, overflow: 'hidden',
                border: selected
                    ? '2.5px solid #60a5fa'
                    : '1.5px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', background: bg.color || '#1e2433',
                transition: 'border-color 0.15s, transform 0.15s',
                transform: selected ? 'scale(0.97)' : 'scale(1)',
                flexShrink: 0,
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
            {bg.url && (
                <img
                    src={bg.url}
                    alt={bg.label}
                    onLoad={() => setImgLoaded(true)}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s',
                        position: 'absolute', inset: 0,
                    }}
                />
            )}

            {/* Label en bas */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                padding: '12px 6px 5px',
                fontSize: 10, fontWeight: 600, color: '#fff',
                textAlign: 'center', lineHeight: 1.2,
            }}>
                {bg.emoji} {bg.label}
            </div>

            {/* Coche sélection */}
            {selected && (
                <div style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <CheckIcon />
                </div>
            )}

            {/* Chargement */}
            {loading && selected && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ animation: 'spin 0.8s linear infinite', color: '#60a5fa' }}>
                        <SpinnerIcon />
                    </div>
                </div>
            )}
        </button>
    );
}

// ─── Composant principal ──────────────────────────────────────
export default function VirtualBackground({ controller, onClose }) {
    const {
        mode, active, loading, loadingMessage, error,
        blurAmount,
        applyBlur, applyImage, applyColor, removeBackground,
        getOutputStream,
    } = controller;

    const [tab,          setTab]          = useState('blur');  // 'blur'|'image'|'color'
    const [selectedId,   setSelectedId]   = useState(null);
    const [selectedColor,setSelectedColor]= useState('#1a1f36');
    const [blur,         setBlur]         = useState(12);
    const [customBg,     setCustomBg]     = useState(null);   // { id, label, url, img }
    const [imgCache,     setImgCache]     = useState({});     // id → HTMLImageElement

    const previewVideoRef = useRef(null);
    const fileInputRef    = useRef(null);

    // ── Aperçu : utiliser le stream de sortie du canvas ────────
    useEffect(() => {
        const el = previewVideoRef.current;
        if (!el) return;
        const stream = getOutputStream();
        if (stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
        }
    });

    // ── Précharger les images prédéfinies ─────────────────────
    const loadImage = useCallback((preset) => {
        return new Promise((resolve) => {
            if (imgCache[preset.id]) { resolve(imgCache[preset.id]); return; }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                setImgCache(prev => ({ ...prev, [preset.id]: img }));
                resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = preset.url;
        });
    }, [imgCache]);

    // ── Sélectionner une image prédéfinie ─────────────────────
    const handleSelectPreset = useCallback(async (preset) => {
        setSelectedId(preset.id);
        setTab('image');
        const img = await loadImage(preset);
        if (img) applyImage(img);
    }, [loadImage, applyImage]);

    // ── Upload image custom ────────────────────────────────────
    const handleUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const custom = {
                    id: 'custom_' + Date.now(),
                    label: file.name.replace(/\.[^.]+$/, ''),
                    emoji: '🖼️',
                    url: ev.target.result,
                    img,
                };
                setCustomBg(custom);
                setSelectedId(custom.id);
                setTab('image');
                applyImage(img);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }, [applyImage]);

    // ── Appliquer le flou ─────────────────────────────────────
    const handleApplyBlur = useCallback(() => {
        setSelectedId('blur');
        setTab('blur');
        applyBlur(blur);
    }, [blur, applyBlur]);

    // ── Appliquer une couleur ─────────────────────────────────
    const handleApplyColor = useCallback((color) => {
        setSelectedColor(color);
        setSelectedId('color_' + color);
        setTab('color');
        applyColor(color);
    }, [applyColor]);

    // ── Supprimer le fond ─────────────────────────────────────
    const handleRemove = useCallback(() => {
        setSelectedId(null);
        removeBackground();
    }, [removeBackground]);

    const allPresets = [
        ...PRESET_BACKGROUNDS,
        ...(customBg ? [customBg] : []),
    ];

    return (
        <ModalFrame
            onClose={onClose}
            badge="Caméra et ambiance"
            title="Arrière-plan virtuel"
            subtitle={active ? 'Actif · traitement en cours' : 'Choisissez un mode ci-dessous'}
            widthClass="max-w-4xl"
            bodyPaddingClass="p-0"
            bodyClassName="bg-[#111827]"
        >
                <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>

                    {/* ── Panneau gauche : aperçu ── */}
                    <div style={{
                        width: 260, flexShrink: 0,
                        padding: '16px',
                        borderRight: '1px solid rgba(255,255,255,0.07)',
                    }}>
                        {/* Preview vidéo */}
                        <div style={{
                            position: 'relative', width: '100%', aspectRatio: '16/9',
                            borderRadius: 12, overflow: 'hidden',
                            background: '#0d1117', marginBottom: 12,
                        }}>
                            <video
                                ref={previewVideoRef}
                                autoPlay playsInline muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {loading && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(0,0,0,0.65)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}>
                                    <div style={{ animation: 'spin 0.8s linear infinite', color: '#60a5fa' }}>
                                        <SpinnerIcon />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {loadingMessage || 'Chargement du fond virtuel…'}
                  </span>
                                </div>
                            )}
                            <div style={{
                                position: 'absolute', bottom: 6, left: 6,
                                background: 'rgba(0,0,0,0.6)', borderRadius: 6,
                                padding: '2px 8px', fontSize: 10, color: 'rgba(255,255,255,0.7)',
                            }}>
                                Aperçu
                            </div>
                        </div>

                        {/* Erreur */}
                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(248,113,113,0.25)',
                                borderRadius: 8, padding: '8px 10px',
                                fontSize: 11, color: '#f87171', lineHeight: 1.5, marginBottom: 10,
                            }}>
                                ⚠ {error}
                            </div>
                        )}

                        {/* Statut actuel */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10, padding: '10px 12px', marginBottom: 10,
                        }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4,
                                textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                                Mode actif
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                                {!active ? 'Aucun'
                                    : mode === 'blur'  ? `Flou (${blur}px)`
                                        : mode === 'image' ? 'Image'
                                            : mode === 'color' ? 'Couleur unie'
                                                : 'Aucun'}
                            </div>
                        </div>

                        {/* Bouton désactiver */}
                        <button
                            onClick={handleRemove}
                            disabled={!active}
                            style={{
                                width: '100%', padding: '8px',
                                borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                background: active ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                                color: active ? '#f87171' : 'rgba(255,255,255,0.3)',
                                fontSize: 12, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s', fontFamily: 'inherit',
                            }}
                        >
                            {active ? '✕ Désactiver' : 'Aucun arrière-plan'}
                        </button>

                        {/* Note BodyPix */}
                        <p style={{
                            fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10,
                            lineHeight: 1.5, textAlign: 'center',
                        }}>
                            Propulsé par TensorFlow BodyPix.<br/>
                            Premier chargement ~4 secondes.
                        </p>
                    </div>

                    {/* ── Panneau droit : sélection ── */}
                    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', maxHeight: 440, minWidth: 320 }}>

                        {/* Tabs */}
                        <div style={{
                            display: 'flex', gap: 6, marginBottom: 16,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 12, padding: 4,
                        }}>
                            {[
                                { key: 'blur',  label: 'Flou',    Icon: BlurIcon  },
                                { key: 'image', label: 'Images',  Icon: ImageIcon },
                                { key: 'color', label: 'Couleurs',Icon: () => <span style={{fontSize:16}}>🎨</span> },
                            ].map(({ key, label, Icon }) => (
                                <button key={key} onClick={() => setTab(key)} style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 6, padding: '7px 10px', borderRadius: 9, border: 'none',
                                    background: tab === key ? 'rgba(59,130,246,0.25)' : 'transparent',
                                    color: tab === key ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s', fontFamily: 'inherit',
                                    borderBottom: tab === key ? '2px solid #3b82f6' : '2px solid transparent',
                                }}>
                                    <Icon /> {label}
                                </button>
                            ))}
                        </div>

                        {/* ── Tab Flou ── */}
                        {tab === 'blur' && (
                            <div>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                                    Floute votre arrière-plan en conservant votre silhouette nette.
                                </p>

                                {/* Prévisualisation floue */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16,
                                }}>
                                    {[
                                        { label: 'Léger', val: 6  },
                                        { label: 'Moyen', val: 14 },
                                        { label: 'Fort',  val: 24 },
                                    ].map(({ label, val }) => (
                                        <button key={val} onClick={() => { setBlur(val); setSelectedId('blur'); applyBlur(val); }}
                                                style={{
                                                    padding: '12px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                                    background: selectedId === 'blur' && blur === val
                                                        ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                                                    color: selectedId === 'blur' && blur === val
                                                        ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                                                    fontSize: 12, fontWeight: 600,
                                                    borderBottom: `2px solid ${selectedId === 'blur' && blur === val ? '#3b82f6' : 'transparent'}`,
                                                    transition: 'all 0.15s', fontFamily: 'inherit',
                                                }}>
                                            <div style={{
                                                width: '100%', height: 40, borderRadius: 6,
                                                background: `rgba(255,255,255,${0.05 + val / 120})`,
                                                filter: `blur(${val / 4}px)`,
                                                marginBottom: 6,
                                            }} />
                                            {label}
                                            <div style={{ fontSize: 10, opacity: 0.6 }}>{val}px</div>
                                        </button>
                                    ))}
                                </div>

                                {/* Slider intensité */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                        fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                                        <span>Intensité du flou</span>
                                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{blur}px</span>
                                    </div>
                                    <input type="range" min="4" max="30" step="1" value={blur}
                                           onChange={e => { const v = +e.target.value; setBlur(v); if (selectedId === 'blur') applyBlur(v); }}
                                           style={{ width: '100%', accentColor: '#3b82f6' }}
                                    />
                                </div>

                                <button onClick={handleApplyBlur} style={{
                                    width: '100%', padding: '11px',
                                    borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: selectedId === 'blur'
                                        ? 'rgba(59,130,246,0.25)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    color: '#fff', fontSize: 13, fontWeight: 700,
                                    fontFamily: 'inherit', transition: 'all 0.15s',
                                    boxShadow: selectedId === 'blur' ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
                                }}>
                                    {selectedId === 'blur' ? '✓ Flou appliqué' : '🌫 Appliquer le flou'}
                                </button>
                            </div>
                        )}

                        {/* ── Tab Images ── */}
                        {tab === 'image' && (
                            <div>
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    marginBottom: 12,
                                }}>
                                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                                        {allPresets.length} fonds disponibles
                                    </p>
                                    {/* Bouton upload */}
                                    <button onClick={() => fileInputRef.current?.click()} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', borderRadius: 8,
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        background: 'rgba(255,255,255,0.07)',
                                        color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                    }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                                    >
                                        <UploadIcon /> Importer
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleUpload}
                                    />
                                </div>

                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                                }}>
                                    {allPresets.map(preset => (
                                        <BgThumb
                                            key={preset.id}
                                            bg={preset}
                                            selected={selectedId === preset.id}
                                            loading={loading && selectedId === preset.id}
                                            onClick={() => handleSelectPreset(preset)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Tab Couleurs ── */}
                        {tab === 'color' && (
                            <div>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                                    Remplace votre arrière-plan par une couleur unie.
                                </p>

                                {/* Palette prédéfinie */}
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
                                }}>
                                    {PRESET_COLORS.map(color => (
                                        <button key={color} onClick={() => handleApplyColor(color)} style={{
                                            width: 44, height: 44, borderRadius: 10, border: 'none',
                                            background: color, cursor: 'pointer',
                                            outline: selectedId === 'color_' + color
                                                ? '3px solid #60a5fa' : '2px solid rgba(255,255,255,0.1)',
                                            outlineOffset: 2,
                                            transition: 'outline 0.15s, transform 0.15s',
                                            transform: selectedId === 'color_' + color ? 'scale(0.92)' : 'scale(1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {selectedId === 'color_' + color && <CheckIcon />}
                                        </button>
                                    ))}
                                </div>

                                {/* Color picker natif */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                                        Couleur personnalisée
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={selectedColor}
                                            onChange={e => {
                                                setSelectedColor(e.target.value);
                                                handleApplyColor(e.target.value);
                                            }}
                                            style={{ width: 44, height: 44, borderRadius: 10, border: 'none',
                                                cursor: 'pointer', background: 'none', padding: 2 }}
                                        />
                                        <span style={{ fontSize: 13, color: '#e2e8f0',
                                            fontFamily: 'monospace', fontWeight: 600 }}>
                      {selectedColor.toUpperCase()}
                    </span>
                                        <div style={{
                                            flex: 1, height: 44, borderRadius: 10,
                                            background: selectedColor,
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }} />
                                    </div>
                                </div>

                                {/* Aperçu personnel sur couleur */}
                                <div style={{
                                    borderRadius: 10, overflow: 'hidden',
                                    background: selectedColor, height: 80,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    position: 'relative',
                                }}>
                                    <span style={{ fontSize: 28 }}>👤</span>
                                    <div style={{
                                        position: 'absolute', bottom: 6, right: 8,
                                        fontSize: 10, color: 'rgba(255,255,255,0.4)',
                                        fontFamily: 'monospace',
                                    }}>
                                        Aperçu couleur
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Note de performance ── */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    padding: '10px 20px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <span style={{ fontSize: 12 }}>⚡</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
            Le traitement s'effectue localement dans votre navigateur via TensorFlow.js.
            Recommandé : ordinateur avec GPU pour de meilleures performances.
          </span>
                </div>
            
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
        </ModalFrame>
    );
}
