import { ENV } from '../../../config/env.js';

function buildPrompt(segments) {
    const transcript = segments
        .slice(-120)
        .map((segment) => `[${new Date(segment.createdAt).toISOString()}] ${segment.speakerName}: ${segment.text}`)
        .join('\n');

    return [
        'Analyse cette transcription de réunion et retourne exclusivement un JSON valide.',
        'Schéma JSON attendu:',
        '{"overview":"string","speakers":["string"],"decisions":[{"speakerName":"string","text":"string"}],"actions":[{"speakerName":"string","text":"string"}],"risks":[{"speakerName":"string","text":"string"}],"keyMoments":[{"speakerName":"string","text":"string"}]}',
        'Contraintes:',
        '- Réponse en français',
        '- Pas de markdown',
        '- Résumer de façon concise et professionnelle',
        '- Si une section est vide, renvoyer []',
        '',
        transcript,
    ].join('\n');
}

export async function generateOpenAISummary({ roomId, segments }) {
    const response = await fetch(ENV.OPENAI_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: ENV.OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Tu extrais des résumés de réunions et réponds exclusivement en JSON valide.',
                },
                {
                    role: 'user',
                    content: buildPrompt(segments),
                },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI summary failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    return {
        roomId,
        generatedAt: Date.now(),
        provider: 'openai',
        overview: parsed?.overview || '',
        speakers: parsed?.speakers || [],
        decisions: parsed?.decisions || [],
        actions: parsed?.actions || [],
        risks: parsed?.risks || [],
        keyMoments: parsed?.keyMoments || [],
    };
}
