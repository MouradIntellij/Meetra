import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { generateHeuristicSummary } from './providers/heuristicSummaryProvider.js';
import { generateOpenAISummary } from './providers/openaiSummaryProvider.js';

export async function generateMeetingSummary(payload) {
    const wantsOpenAI = ENV.SUMMARY_PROVIDER === 'openai' && Boolean(ENV.OPENAI_API_KEY);

    if (wantsOpenAI) {
        try {
            return await generateOpenAISummary(payload);
        } catch (error) {
            logger.warn('OpenAI summary fallback to heuristic:', error?.message);
        }
    }

    return generateHeuristicSummary(payload);
}
