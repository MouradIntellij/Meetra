import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { transcribeWithNoopProvider } from './providers/noopTranscriptionProvider.js';
import { transcribeWithOpenAI } from './providers/openaiTranscriptionProvider.js';

export function getTranscriptionCapabilities() {
    const serverProviderAvailable =
        ENV.TRANSCRIPTION_PROVIDER === 'openai' && Boolean(ENV.OPENAI_API_KEY);

    return {
        preferredMode: serverProviderAvailable ? 'server' : 'browser',
        serverProviderAvailable,
        provider: serverProviderAvailable ? 'openai' : 'browser',
    };
}

export async function transcribeAudioChunk(payload) {
    const capabilities = getTranscriptionCapabilities();

    if (!capabilities.serverProviderAvailable) {
        return transcribeWithNoopProvider(payload);
    }

    try {
        return await transcribeWithOpenAI(payload);
    } catch (error) {
        logger.warn('Server-side transcription fallback to noop:', error?.message);
        return transcribeWithNoopProvider(payload);
    }
}
