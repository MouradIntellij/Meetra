import { useTranscription } from '../../context/TranscriptionContext.jsx';

export default function CaptionsOverlay() {
    const {
        visibleCaptions,
        transcriptionActive,
        captionsEnabled,
        translationTarget,
        translationLabel,
        resolveSegmentText,
    } = useTranscription();

    if (!captionsEnabled || !visibleCaptions) return null;

    const captionText = resolveSegmentText(visibleCaptions);
    const showOriginal = translationTarget !== 'original' && captionText !== visibleCaptions.text;

    return (
        <div style={{
            position: 'absolute',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            zIndex: 60,
            width: 'min(860px, calc(100% - 32px))',
            pointerEvents: 'none',
        }}>
            <div style={{
                borderRadius: 18,
                background: 'rgba(2,6,23,0.82)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(18px)',
                padding: '12px 16px',
                color: '#f8fafc',
                textAlign: 'center',
            }}>
                <div style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: transcriptionActive ? '#4ade80' : 'rgba(255,255,255,0.45)',
                    fontWeight: 800,
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                }}>
                    <span>{visibleCaptions.speakerName || 'Sous-titres'}</span>
                    {translationTarget !== 'original' && (
                        <span style={{
                            borderRadius: 999,
                            border: '1px solid rgba(74,222,128,0.2)',
                            background: 'rgba(34,197,94,0.12)',
                            padding: '4px 8px',
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            color: '#bbf7d0',
                        }}>
                            Traduction {translationLabel}
                        </span>
                    )}
                </div>
                <div style={{
                    fontSize: 20,
                    lineHeight: 1.45,
                    fontWeight: 600,
                    color: '#f8fafc',
                }}>
                    {captionText}
                </div>
                {showOriginal && (
                    <div style={{
                        marginTop: 8,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'rgba(226,232,240,0.66)',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        {visibleCaptions.text}
                    </div>
                )}
            </div>
        </div>
    );
}
