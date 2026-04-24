const ACTION_PATTERNS = [
    /\b(il faut|je vais|on va|tu peux|merci de|à faire|action)\b/i,
    /\b(todo|next step|prochaine étape)\b/i,
];

const DECISION_PATTERNS = [
    /\b(on décide|décision|retenu|validé|approuvé|on garde|on choisit)\b/i,
];

const RISK_PATTERNS = [
    /\b(risque|bloquant|problème|erreur|incident|retard|instable)\b/i,
];

function uniqueByText(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = item.text.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function generateHeuristicSummary({ roomId, segments }) {
    const actions = uniqueByText(
        segments
            .filter((segment) => ACTION_PATTERNS.some((pattern) => pattern.test(segment.text)))
            .slice(0, 8)
            .map((segment) => ({
                speakerName: segment.speakerName,
                text: segment.text,
                createdAt: segment.createdAt,
            }))
    );

    const decisions = uniqueByText(
        segments
            .filter((segment) => DECISION_PATTERNS.some((pattern) => pattern.test(segment.text)))
            .slice(0, 6)
            .map((segment) => ({
                speakerName: segment.speakerName,
                text: segment.text,
                createdAt: segment.createdAt,
            }))
    );

    const risks = uniqueByText(
        segments
            .filter((segment) => RISK_PATTERNS.some((pattern) => pattern.test(segment.text)))
            .slice(0, 6)
            .map((segment) => ({
                speakerName: segment.speakerName,
                text: segment.text,
                createdAt: segment.createdAt,
            }))
    );

    const speakers = [...new Set(segments.map((segment) => segment.speakerName).filter(Boolean))];
    const keyMoments = uniqueByText(
        segments
            .slice(-10)
            .slice(0, 5)
            .map((segment) => ({
                speakerName: segment.speakerName,
                text: segment.text,
                createdAt: segment.createdAt,
            }))
    );

    const overviewParts = [];
    overviewParts.push(`Intervenants principaux: ${speakers.length > 0 ? speakers.join(', ') : 'non détectés'}.`);
    overviewParts.push(`Segments transcrits: ${segments.length}.`);
    if (decisions.length > 0) overviewParts.push(`${decisions.length} décision(s) identifiée(s).`);
    if (actions.length > 0) overviewParts.push(`${actions.length} action(s) à suivre repérée(s).`);
    if (risks.length > 0) overviewParts.push(`${risks.length} risque(s) ou point(s) bloquant(s) mentionné(s).`);

    return {
        roomId,
        generatedAt: Date.now(),
        provider: 'heuristic',
        overview: overviewParts.join(' '),
        speakers,
        decisions,
        actions,
        risks,
        keyMoments,
    };
}
