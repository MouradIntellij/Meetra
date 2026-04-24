import { getTranscriptSegments, getTranscriptSummary, setTranscriptSummary } from './transcriptStore.js';
import { generateMeetingSummary } from './summaryProvider.js';

export async function buildMeetingSummary(roomId, { forceRefresh = false } = {}) {
    const existing = getTranscriptSummary(roomId);
    if (existing && !forceRefresh) return existing;

    const segments = getTranscriptSegments(roomId);
    const summary = await generateMeetingSummary({ roomId, segments });
    setTranscriptSummary(roomId, summary);
    return summary;
}
