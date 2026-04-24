import { useMemo, useState } from 'react';
import { useTranscription } from '../../context/TranscriptionContext.jsx';
import SummaryPanel from './SummaryPanel.jsx';

export default function TranscriptPanel() {
    const {
        transcriptOpen,
        setTranscriptOpen,
        segments,
        exportTranscript,
        transcriptionActive,
        startTranscription,
        stopTranscription,
        language,
        setLanguage,
        speechRecognitionSupported,
        error,
        transcriptionMode,
        transcriptionProvider,
        serverProviderAvailable,
    } = useTranscription();
    const [query, setQuery] = useState('');

    const modeLabel =
        transcriptionMode === 'server'
            ? `Serveur${transcriptionProvider === 'openai' ? ' · OpenAI' : ''}`
            : 'Navigateur local';

    const modeDescription =
        transcriptionMode === 'server'
            ? 'Le micro est envoyé par chunks au serveur pour transcription centralisée.'
            : 'La transcription est effectuée localement par le runtime navigateur/Electron.';

    const filteredSegments = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return segments;
        return segments.filter((segment) =>
            segment.text.toLowerCase().includes(normalized) ||
            segment.speakerName.toLowerCase().includes(normalized)
        );
    }, [segments, query]);

    if (!transcriptOpen) return null;

    return (
        <aside style={{
            width: 360,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.98) 100%)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
        }}>
            <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            Transcription
                        </div>
                        <div style={{ marginTop: 4, fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
                            Réunion
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setTranscriptOpen(false)}
                        style={{ border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 999, width: 32, height: 32, cursor: 'pointer' }}
                    >
                        ×
                    </button>
                </div>

                <div style={{
                    marginTop: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '10px 12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>
                            Moteur de transcription
                        </div>
                        <div style={{
                            borderRadius: 999,
                            padding: '4px 8px',
                            background: transcriptionMode === 'server' ? 'rgba(34,197,94,0.16)' : 'rgba(59,130,246,0.16)',
                            color: transcriptionMode === 'server' ? '#bbf7d0' : '#bfdbfe',
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}>
                            {modeLabel}
                        </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                        {modeDescription}
                    </div>
                    {transcriptionMode !== 'server' && (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
                            {serverProviderAvailable
                                ? 'Un provider serveur est disponible mais ce runtime utilise actuellement le mode local.'
                                : 'Aucun provider STT serveur n’est configuré, fallback local actif.'}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button
                        type="button"
                        onClick={transcriptionActive ? stopTranscription : startTranscription}
                        disabled={transcriptionMode === 'browser' && !speechRecognitionSupported}
                        style={{
                            flex: 1,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: transcriptionActive ? 'rgba(34,197,94,0.16)' : 'rgba(59,130,246,0.16)',
                            color: '#f8fafc',
                            borderRadius: 12,
                            padding: '10px 12px',
                            cursor: (transcriptionMode === 'browser' && !speechRecognitionSupported) ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            opacity: (transcriptionMode === 'browser' && !speechRecognitionSupported) ? 0.45 : 1,
                        }}
                    >
                        {transcriptionActive ? 'Arrêter' : 'Démarrer'}
                    </button>
                    <button
                        type="button"
                        onClick={exportTranscript}
                        style={{
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#e2e8f0',
                            borderRadius: 12,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        Export
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Rechercher..."
                        style={{
                            flex: 1,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#f8fafc',
                            padding: '10px 12px',
                            outline: 'none',
                        }}
                    />
                    <select
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                        style={{
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#f8fafc',
                            padding: '10px 12px',
                            outline: 'none',
                        }}
                    >
                        <option value="fr-CA">FR-CA</option>
                        <option value="fr-FR">FR-FR</option>
                        <option value="en-US">EN-US</option>
                    </select>
                </div>

                {error && (
                    <div style={{
                        marginTop: 10,
                        borderRadius: 12,
                        border: '1px solid rgba(248,113,113,0.22)',
                        background: 'rgba(127,29,29,0.24)',
                        color: '#fee2e2',
                        padding: '10px 12px',
                        fontSize: 12,
                    }}>
                        {error}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {filteredSegments.length === 0 ? (
                    <div style={{
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        padding: 16,
                        color: 'rgba(255,255,255,0.46)',
                        fontSize: 13,
                        lineHeight: 1.6,
                    }}>
                        La transcription apparaîtra ici au fur et à mesure de la réunion.
                    </div>
                ) : (
                    filteredSegments.map((segment) => (
                        <div
                            key={segment.id}
                            style={{
                                borderRadius: 16,
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                                padding: '12px 14px',
                                marginBottom: 10,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ color: '#bfdbfe', fontSize: 12, fontWeight: 700 }}>{segment.speakerName}</div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                                    {new Date(segment.createdAt).toLocaleTimeString()}
                                </div>
                            </div>
                            <div style={{ marginTop: 6, color: '#f8fafc', fontSize: 14, lineHeight: 1.6 }}>
                                {segment.text}
                            </div>
                        </div>
                    ))
                )}

                <SummaryPanel />
            </div>
        </aside>
    );
}
