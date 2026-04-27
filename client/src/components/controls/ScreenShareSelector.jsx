import { useEffect, useMemo, useRef, useState } from 'react';
import { platform } from '../../services/platform/index.js';
import ModalFrame from '../common/ModalFrame.jsx';

const SOURCES = [
    {
        id: 'monitor',
        label: 'Plein ecran',
        title: 'Partager tout l’ecran',
        description: 'Ideal pour une demo complete avec plusieurs applications.',
        tip: 'Les participants verront tout ce qui apparait sur votre moniteur.',
        accent: '#22c55e',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
            </svg>
        ),
    },
    {
        id: 'window',
        label: 'Application',
        title: 'Partager une fenetre',
        description: 'Le plus proche du partage Zoom/Teams pour isoler une app.',
        tip: 'Choisissez ensuite Word, VS Code, Chrome ou une autre fenetre.',
        accent: '#60a5fa',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
                <circle cx="7" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
            </svg>
        ),
    },
    {
        id: 'browser',
        label: 'Onglet',
        title: 'Partager un onglet navigateur',
        description: 'Recommande pour video, YouTube ou contenu avec audio.',
        tip: 'Activez le son si vous voulez transmettre l’audio de l’onglet.',
        accent: '#f59e0b',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 9h18" />
                <path d="M7 7h.01M11 7h.01M15 7h.01" />
            </svg>
        ),
    },
];

function LivePreview({ stream, className }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream || null;
        if (stream) {
            el.play().catch(() => {});
        }
        return () => {
            if (el) {
                el.pause();
                el.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={className}
        />
    );
}

function SurfacePreview({ source, active, showGreenBorder, previewUrl, previewName }) {
    const palette = {
        monitor: {
            bg: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0b1120 100%)',
            panel: '#111827',
        },
        window: {
            bg: 'linear-gradient(135deg, #101827 0%, #1d4ed8 40%, #0f172a 100%)',
            panel: '#f8fafc',
        },
        browser: {
            bg: 'linear-gradient(135deg, #231b0b 0%, #b45309 50%, #111827 100%)',
            panel: '#f8fafc',
        },
    }[source.id];

    return (
        <div
            className={`relative aspect-video overflow-hidden rounded-2xl border transition-all duration-200 ${
                active ? 'border-white/30 shadow-[0_20px_60px_rgba(0,0,0,0.45)]' : 'border-white/10'
            }`}
            style={{
                background: palette.bg,
                boxShadow: showGreenBorder ? '0 0 0 3px rgba(34,197,94,0.95), 0 20px 60px rgba(0,0,0,0.45)' : undefined,
            }}
        >
            {previewUrl && (
                <img
                    src={previewUrl}
                    alt={previewName || source.title}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            )}
            {previewUrl && <div className="absolute inset-0 bg-slate-950/20" />}

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                {source.icon}
                <span>{previewName || source.title}</span>
            </div>

            {!previewUrl && (
                <>
                    <div className="absolute inset-x-6 top-14 h-4 rounded-full bg-white/10" />
                    <div className="absolute inset-x-6 top-24 flex gap-4">
                        <div className="h-36 flex-1 rounded-2xl border border-white/15 bg-black/20" />
                        <div
                            className="h-36 w-[34%] rounded-2xl border"
                            style={{
                                background: palette.panel,
                                borderColor: source.id === 'window' ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.18)',
                            }}
                        />
                    </div>

                    <div
                        className="absolute bottom-5 right-5 h-20 w-32 overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-2xl"
                        style={showGreenBorder ? { boxShadow: '0 0 0 2px rgba(34,197,94,0.95), 0 10px 25px rgba(0,0,0,0.35)' } : undefined}
                    >
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/85">
                            Preview
                        </div>
                    </div>
                </>
            )}

            {previewUrl && (
                <div className="absolute bottom-5 right-5 rounded-full border border-green-400/35 bg-slate-950/70 px-3 py-1.5 text-[11px] font-semibold text-green-200 backdrop-blur-md">
                    Source detectee
                </div>
            )}

            {showGreenBorder && (
                <div className="absolute inset-0 rounded-2xl border-[3px] border-green-500 pointer-events-none" />
            )}
        </div>
    );
}

function OptionToggle({ checked, onChange, label, description }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
        >
            <div>
                <div className="text-sm font-semibold text-slate-100">{label}</div>
                <div className="mt-1 text-xs text-slate-400">{description}</div>
            </div>
            <span
                className={`relative ml-4 h-6 w-11 rounded-full transition ${
                    checked ? 'bg-blue-500' : 'bg-slate-700'
                }`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        checked ? 'left-6' : 'left-1'
                    }`}
                />
            </span>
        </button>
    );
}

function MiniNativeHint({ sourceId }) {
    if (platform.isElectron && sourceId === 'monitor') {
        return <p className="text-xs leading-5 text-slate-400">Mode desktop: vraies miniatures disponibles. Choisissez directement une source ci-dessous.</p>;
    }

    const label =
        sourceId === 'window'
            ? 'Le sélecteur natif Windows va s’ouvrir pour choisir une application.'
            : sourceId === 'browser'
                ? 'Le navigateur va ouvrir la boite native pour choisir un onglet.'
                : 'Le navigateur va ouvrir la boite native pour choisir un ecran.';

    return <p className="text-xs leading-5 text-slate-400">{label}</p>;
}

function ElectronSourceCard({ source, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`overflow-hidden rounded-[22px] border text-left transition ${
                active
                    ? 'border-emerald-400/35 bg-emerald-400/10 shadow-[0_18px_50px_rgba(16,185,129,0.14)]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
            }`}
        >
            <div className="relative aspect-video overflow-hidden bg-slate-950">
                {source.thumbnailDataUrl ? (
                    <img src={source.thumbnailDataUrl} alt={source.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                        No Preview
                    </div>
                )}
                {active && (
                    <div className="absolute inset-0 border-[3px] border-green-500 pointer-events-none" />
                )}
                <div className="absolute left-3 top-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300 backdrop-blur-md">
                    Selection
                </div>
            </div>
            <div className="flex items-center gap-3 p-3">
                {source.appIconDataUrl ? (
                    <img src={source.appIconDataUrl} alt="" className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 object-contain p-1" />
                ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                            <rect x="3" y="4" width="18" height="14" rx="2" />
                            <path d="M8 20h8M12 18v2" />
                        </svg>
                    </div>
                )}
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{source.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{source.displayId ? `Display ${source.displayId}` : 'Source desktop'}</div>
                </div>
            </div>
        </button>
    );
}

export default function ScreenShareSelector({ onSelect, onCancel, activeShare }) {
    const [selectedSource, setSelectedSource] = useState('window');
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewName, setPreviewName] = useState('');
    const [recentPreviews, setRecentPreviews] = useState([]);
    const [electronSources, setElectronSources] = useState([]);
    const [selectedElectronSourceId, setSelectedElectronSourceId] = useState('');
    const [error, setError] = useState('');
    const [options, setOptions] = useState({
        sound: false,
        presenter: true,
        optimize: 'detail',
    });
    const previewStreamRef = useRef(null);
    const previewSourceRef = useRef(null);
    const visibleSources = useMemo(
        () => (platform.isElectron ? SOURCES.filter((item) => item.id !== 'browser') : SOURCES),
        []
    );
    const selectedElectronSource = useMemo(
        () => electronSources.find((item) => item.id === selectedElectronSourceId) || null,
        [electronSources, selectedElectronSourceId]
    );

    const activeSource = useMemo(
        () => visibleSources.find((item) => item.id === selectedSource) || visibleSources[0],
        [selectedSource, visibleSources]
    );

    useEffect(() => {
        return () => {
            previewStreamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, []);

    useEffect(() => {
        if (previewSourceRef.current === selectedSource) return;
        previewStreamRef.current?.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
        previewSourceRef.current = null;
        setPreviewUrl(null);
        setPreviewName('');
        setError('');
    }, [selectedSource]);

    useEffect(() => {
        if (!platform.isElectron || selectedSource === 'browser') {
            setElectronSources([]);
            setSelectedElectronSourceId('');
            return;
        }

        let ignore = false;

        const loadElectronSources = async () => {
            setLoading(true);
            setError('');

            try {
                const types = selectedSource === 'monitor' ? ['screen'] : ['window'];
                const sources = await platform.getScreenSources({
                    types,
                    thumbnailSize: { width: 640, height: 360 },
                });

                if (ignore) return;

                setElectronSources(sources);

                if (sources[0]) {
                    setSelectedElectronSourceId((current) => {
                        const exists = sources.some((item) => item.id === current);
                        return exists ? current : sources[0].id;
                    });
                    setPreviewUrl(sources[0].thumbnailDataUrl || null);
                    setPreviewName(sources[0].name || activeSource.title);
                }
            } catch {
                if (!ignore) {
                    setError("Impossible de charger les sources Electron.");
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        loadElectronSources();

        return () => {
            ignore = true;
        };
    }, [selectedSource, activeSource.title]);

    const updateOption = (key, value) => {
        setOptions((current) => ({ ...current, [key]: value }));
    };

    const rememberPreview = (sourceId, name, imageUrl) => {
        if (!imageUrl) return;

        setRecentPreviews((current) => {
            const nextItem = {
                id: `${sourceId}-${name}`,
                sourceId,
                name,
                imageUrl,
            };

            const deduped = current.filter((item) => item.id !== nextItem.id);
            return [nextItem, ...deduped].slice(0, 6);
        });
    };

    const captureFrame = async (stream) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        video.pause();
        video.srcObject = null;
        return canvas.toDataURL('image/jpeg', 0.82);
    };

    const buildDisplayMediaOptions = () => {
        const wantsBrowser = selectedSource === 'browser';
        const wantsWindowOnElectron = platform.isElectron && selectedSource === 'window';

        if (wantsWindowOnElectron) {
            return {
                video: true,
                audio: false,
            };
        }

        return {
            video: {
                displaySurface: selectedSource,
                frameRate: options.optimize === 'motion' ? { ideal: 30, max: 60 } : { ideal: 15, max: 30 },
            },
            audio: Boolean(options.sound),
            preferCurrentTab: wantsBrowser,
            selfBrowserSurface: wantsBrowser ? 'include' : 'exclude',
            surfaceSwitching: 'include',
            systemAudio: options.sound ? 'include' : 'exclude',
        };
    };

    const handleGeneratePreview = async () => {
        if (platform.isElectron && selectedSource !== 'browser') {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia(buildDisplayMediaOptions());
            previewStreamRef.current?.getTracks().forEach((track) => track.stop());
            previewStreamRef.current = stream;
            previewSourceRef.current = selectedSource;

            const track = stream.getVideoTracks()[0];
            const frame = await captureFrame(stream);
            const resolvedName = track?.label || activeSource.title;

            setPreviewUrl(frame);
            setPreviewName(resolvedName);
            rememberPreview(selectedSource, resolvedName, frame);
        } catch (err) {
            if (err?.name !== 'NotAllowedError') {
                setError("Impossible de recuperer l'aperçu.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        setLoading(true);
        setError('');

        try {
            let stream;
            let track;
            let settings;

            if (platform.isElectron && selectedSource === 'monitor') {
                const selectedElectronSource = electronSources.find((item) => item.id === selectedElectronSourceId);
                if (!selectedElectronSource) {
                    setError('Choisissez une source desktop.');
                    setLoading(false);
                    return;
                }

                stream = await platform.getShareStream({
                    sourceId: selectedElectronSource.id,
                    withAudio: options.sound,
                    optimize: options.optimize,
                });
                track = stream.getVideoTracks()[0];
                settings = {
                    displaySurface: selectedSource === 'monitor' ? 'monitor' : 'window',
                };
            } else if (platform.isElectron && selectedSource === 'window') {
                const selectedElectronSource = electronSources.find((item) => item.id === selectedElectronSourceId);

                try {
                    stream = previewStreamRef.current || await navigator.mediaDevices.getDisplayMedia(buildDisplayMediaOptions());
                    track = stream.getVideoTracks()[0];
                    settings = track?.getSettings?.() ?? {};
                } catch (nativeError) {
                    if (!selectedElectronSource) {
                        throw nativeError;
                    }

                    stream = await platform.getShareStream({
                        sourceId: selectedElectronSource.id,
                        withAudio: false,
                        optimize: options.optimize,
                    });
                    track = stream.getVideoTracks()[0];
                    settings = {
                        displaySurface: 'window',
                    };
                }
            } else {
                stream = previewStreamRef.current || await navigator.mediaDevices.getDisplayMedia(buildDisplayMediaOptions());
                track = stream.getVideoTracks()[0];
                settings = track?.getSettings?.() ?? {};
            }

            previewStreamRef.current = null;
            previewSourceRef.current = null;

            onSelect(stream, {
                ...options,
                displaySurface: settings.displaySurface || selectedSource,
                sourceLabel:
                    ((platform.isElectron && selectedSource !== 'browser')
                        ? electronSources.find((item) => item.id === selectedElectronSourceId)?.name
                        : '') || track?.label || activeSource.title,
                presenterMode: options.presenter,
            });
        } catch (err) {
            if (err?.name !== 'NotAllowedError') {
                const detail = [err?.name, err?.message].filter(Boolean).join(' - ');
                setError(detail ? `Le partage a échoué. ${detail}` : 'Le partage a échoué.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalFrame
            onClose={onCancel}
            badge="Partage d’écran"
            title="Choisir une source à partager"
            subtitle="Préparez une source propre pour une démonstration, une application ou un onglet audio."
            widthClass="max-w-6xl"
            bodyPaddingClass="p-0"
            bodyClassName="bg-[#0a1020] text-white"
        >
            <div className="flex min-w-0 flex-1 flex-col">
                    <div className="border-b border-white/10 px-8 py-5">
                        <p className="max-w-2xl text-sm leading-6 text-slate-400">
                                {platform.isElectron
                                    ? selectedSource === 'window'
                                        ? 'Pour une application, le sélecteur natif Windows va s’ouvrir. Si Windows refuse, Meetra retombera sur la galerie desktop.'
                                        : 'Choisissez un type de source puis sélectionnez directement une fenêtre ou un écran dans la galerie desktop.'
                                    : 'Pour une experience proche de Zoom ou Teams, choisissez le type de source ici, puis le navigateur ouvrira la fenetre native de selection de votre systeme.'}
                            </p>
                            <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">
                                {platform.isElectron
                                    ? selectedSource === 'window'
                                        ? 'Le mode application essaie d’abord le picker système, puis utilise la galerie desktop en secours si nécessaire.'
                                        : 'Mode Electron actif: les miniatures desktop réelles sont disponibles pour les écrans.'
                                    : 'Limite du web: le navigateur ne fournit pas la vraie galerie de miniatures de toutes vos applications avant selection. En revanche, vous pouvez maintenant capturer un aperçu réel de la source choisie puis partager cette même source sans rouvrir la boite.'}
                            </p>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1.25fr_0.75fr]">
                        <div className="min-w-0 overflow-y-auto border-r border-white/10 px-8 py-7">
                            <div className={`grid gap-4 ${visibleSources.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                                {visibleSources.map((source) => {
                                    const selected = source.id === selectedSource;
                                    return (
                                        <button
                                            key={source.id}
                                            type="button"
                                            onClick={() => setSelectedSource(source.id)}
                                            className={`rounded-[24px] border p-4 text-left transition ${
                                                selected ? 'border-white/25 bg-white/[0.08]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                                    style={{ background: `${source.accent}22`, color: source.accent }}
                                                >
                                                    {source.icon}
                                                </div>
                                                {selected && (
                                                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                                                        Select
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-base font-semibold text-slate-50">{source.label}</div>
                                            <div className="mt-2 text-sm leading-6 text-slate-400">{source.description}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-7">
                                <SurfacePreview
                                    source={activeSource}
                                    active
                                    showGreenBorder={Boolean(previewUrl || activeShare)}
                                    previewUrl={previewUrl}
                                    previewName={previewName}
                                />
                            </div>

                            <div className="mt-5 flex items-start justify-between gap-6 rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
                                <div>
                                    <div className="text-sm font-semibold text-emerald-300">
                                        {platform.isElectron
                                            ? selectedSource === 'window'
                                                ? 'Sélecteur natif Windows'
                                                : 'Selection desktop directe'
                                            : 'Aperçu et selection systeme'}
                                    </div>
                                    <div className="mt-1 text-sm leading-6 text-emerald-50/80">
                                        {platform.isElectron
                                            ? selectedSource === 'window'
                                                ? activeSource.tip
                                                : selectedElectronSource
                                                ? `Source choisie: ${selectedElectronSource.name}`
                                                : activeSource.tip
                                            : activeSource.tip}
                                    </div>
                                </div>
                                {(!platform.isElectron || selectedSource === 'window') && (
                                    <button
                                        type="button"
                                        onClick={handleGeneratePreview}
                                        disabled={loading}
                                        className="shrink-0 rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-60"
                                    >
                                        {loading ? 'Ouverture...' : previewUrl ? "Changer l’aperçu" : "Choisir et prévisualiser"}
                                    </button>
                                )}
                            </div>

                            {platform.isElectron && (
                                <div className="mt-5">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">
                                            Sources disponibles
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {loading ? 'Chargement des miniatures…' : `${electronSources.length} source${electronSources.length > 1 ? 's' : ''}`}
                                        </div>
                                    </div>
                                    <div className="grid max-h-[34vh] gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
                                        {electronSources.map((source) => (
                                            <ElectronSourceCard
                                                key={source.id}
                                                source={source}
                                                active={source.id === selectedElectronSourceId}
                                                onClick={() => {
                                                    setSelectedElectronSourceId(source.id);
                                                    setPreviewUrl(source.thumbnailDataUrl || null);
                                                    setPreviewName(source.name || activeSource.title);
                                                    setError('');
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!platform.isElectron && recentPreviews.length > 0 && (
                                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">Recents</div>
                                            <div className="mt-1 text-sm text-slate-300">Dernières sources prévisualisées</div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Cliquez pour retrouver visuellement une source déjà testée.
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {recentPreviews.map((item) => {
                                            const isSelected = item.name === previewName && item.imageUrl === previewUrl;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSource(item.sourceId);
                                                        setPreviewUrl(item.imageUrl);
                                                        setPreviewName(item.name);
                                                        setError('');
                                                    }}
                                                    className={`overflow-hidden rounded-2xl border text-left transition ${
                                                        isSelected
                                                            ? 'border-emerald-400/40 bg-emerald-400/10'
                                                            : 'border-white/10 bg-slate-950/40 hover:bg-white/[0.05]'
                                                    }`}
                                                >
                                                    <div className="aspect-video overflow-hidden bg-black">
                                                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                                    </div>
                                                    <div className="p-3">
                                                        <div className="truncate text-sm font-semibold text-slate-100">{item.name}</div>
                                                        <div className="mt-1 text-xs text-slate-400">
                                                            {item.sourceId === 'window' ? 'Application' : item.sourceId === 'browser' ? 'Onglet' : 'Plein ecran'}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <aside className="flex min-h-0 flex-col overflow-y-auto bg-white/[0.02] px-7 py-7">
                            <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">Options</div>

                            <div className="mt-5 space-y-3">
                                <OptionToggle
                                    checked={options.sound}
                                    onChange={() => updateOption('sound', !options.sound)}
                                    label="Partager le son"
                                    description="Utile pour un onglet navigateur, une video ou une demo multimedia."
                                />
                                <OptionToggle
                                    checked={options.presenter}
                                    onChange={() => updateOption('presenter', !options.presenter)}
                                    label="Mode presentateur"
                                    description="Affiche votre camera dans une petite vignette pendant le partage."
                                />
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                <label className="text-sm font-semibold text-slate-100">Optimiser pour</label>
                                <select
                                    value={options.optimize}
                                    onChange={(event) => updateOption('optimize', event.target.value)}
                                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-400"
                                >
                                    <option value="detail">Texte et details</option>
                                    <option value="motion">Video et mouvement</option>
                                </select>
                            </div>

                            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/50 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">
                                    {platform.isElectron ? 'Selection active' : 'Apercu'}
                                </div>
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
                                    {previewStreamRef.current ? (
                                        <LivePreview stream={previewStreamRef.current} className="aspect-video w-full object-cover" />
                                    ) : previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="aspect-video w-full object-cover" />
                                    ) : (
                                        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-6 text-center text-sm leading-6 text-slate-500">
                                            {platform.isElectron
                                                ? selectedSource === 'window'
                                                    ? 'Le sélecteur Windows sera tenté en priorité. En cas d’échec, la source choisie ici servira de secours.'
                                                    : 'Choisissez une source dans la galerie pour afficher sa miniature ici.'
                                                : 'L’aperçu réel apparait ici après choix dans la fenêtre native.'}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 text-sm font-medium text-slate-200">
                                    {previewName || activeSource.title}
                                </div>
                                {platform.isElectron && selectedElectronSource && (
                                    <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                                        Prêt à partager: {selectedElectronSource.name}
                                    </div>
                                )}
                                <div className="mt-1">
                                    <MiniNativeHint sourceId={selectedSource} />
                                </div>
                            </div>

                            {activeShare && (
                                <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                                    Partage actif: {activeShare.label || 'Source courante'}
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="sticky bottom-0 mt-auto bg-[linear-gradient(180deg,rgba(10,16,32,0)_0%,rgba(10,16,32,0.92)_18%,rgba(10,16,32,1)_100%)] pt-6">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onCancel}
                                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                    type="button"
                                    onClick={handleShare}
                                    disabled={loading}
                                    className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
                                    >
                                        {loading
                                            ? 'Ouverture...'
                                            : platform.isElectron
                                                ? 'Partager cette source'
                                                : previewStreamRef.current
                                                    ? 'Partager cette source'
                                                    : previewUrl
                                                        ? 'Rechoisir et partager'
                                                        : 'Choisir et partager'}
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </div>
            </div>
        </ModalFrame>
    );
}
