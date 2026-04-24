import { useTranscription } from '../../context/TranscriptionContext.jsx';

export default function CaptionsOverlay() {
    const { visibleCaptions, transcriptionActive, captionsEnabled } = useTranscription();

    if (!captionsEnabled || !visibleCaptions) return null;

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
                }}>
                    {visibleCaptions.speakerName || 'Sous-titres'}
                </div>
                <div style={{
                    fontSize: 20,
                    lineHeight: 1.45,
                    fontWeight: 600,
                    color: '#f8fafc',
                }}>
                    {visibleCaptions.text}
                </div>
            </div>
        </div>
    );
}
