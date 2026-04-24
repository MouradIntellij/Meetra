import { useTranscription } from '../../context/TranscriptionContext.jsx';

function SummaryBlock({ title, items, accent }) {
    return (
        <div style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            padding: 14,
            marginTop: 12,
        }}>
            <div style={{ fontSize: 11, color: accent, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                {title}
            </div>
            {items.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                    Aucun élément détecté pour l’instant.
                </div>
            ) : (
                items.map((item, index) => (
                    <div key={`${title}-${index}-${item.text}`} style={{ marginBottom: index === items.length - 1 ? 0 : 10 }}>
                        <div style={{ color: '#f8fafc', fontSize: 14, lineHeight: 1.6 }}>{item.text}</div>
                        <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                            {item.speakerName || 'Participant'}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

export default function SummaryPanel() {
    const { summary, summaryLoading, generateSummary, refreshSummary } = useTranscription();

    return (
        <div style={{
            marginTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 16,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        Summary
                    </div>
                    <div style={{ marginTop: 4, fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
                        Réunion
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={generateSummary}
                        style={{
                            border: '1px solid rgba(59,130,246,0.25)',
                            background: 'rgba(59,130,246,0.16)',
                            color: '#dbeafe',
                            borderRadius: 12,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        {summaryLoading ? 'Analyse...' : 'Générer'}
                    </button>
                    <button
                        type="button"
                        onClick={refreshSummary}
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
                        Rafraîchir
                    </button>
                </div>
            </div>

            {!summary ? (
                <div style={{
                    marginTop: 12,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: 16,
                    color: 'rgba(255,255,255,0.46)',
                    fontSize: 13,
                    lineHeight: 1.6,
                }}>
                    Générez un résumé pour obtenir une vue synthétique de la réunion, les décisions prises et les actions à suivre.
                </div>
            ) : (
                <>
                    <div style={{
                        marginTop: 12,
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        padding: 16,
                    }}>
                        <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                            Vue d’ensemble
                        </div>
                        <div style={{ color: '#f8fafc', fontSize: 14, lineHeight: 1.7 }}>
                            {summary.overview}
                        </div>
                    </div>

                    <SummaryBlock title="Décisions" items={summary.decisions || []} accent="#4ade80" />
                    <SummaryBlock title="Actions" items={summary.actions || []} accent="#fbbf24" />
                    <SummaryBlock title="Risques" items={summary.risks || []} accent="#f87171" />
                    <SummaryBlock title="Moments clés" items={summary.keyMoments || []} accent="#c4b5fd" />
                </>
            )}
        </div>
    );
}
