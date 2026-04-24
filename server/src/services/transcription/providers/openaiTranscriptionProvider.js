import { ENV } from '../../../config/env.js';

function base64ToBuffer(base64) {
    return Buffer.from(base64, 'base64');
}

export async function transcribeWithOpenAI({ base64Audio, mimeType = 'audio/webm', language }) {
    const form = new FormData();
    const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('wav') ? 'wav' : 'bin';
    const blob = new Blob([base64ToBuffer(base64Audio)], { type: mimeType });

    form.append('file', blob, `chunk.${extension}`);
    form.append('model', ENV.OPENAI_TRANSCRIPTION_MODEL);
    if (language) {
        form.append('language', language.split('-')[0]);
    }
    form.append('response_format', 'json');

    const response = await fetch(ENV.OPENAI_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
        },
        body: form,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI transcription failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    return {
        text: payload?.text || '',
        provider: 'openai',
        raw: payload,
    };
}
