import { getTranscriptSegments, getTranscriptSummary, setTranscriptSummary } from './transcriptStore.js';
import { generateMeetingSummary } from './summaryProvider.js';

export async function buildMeetingSummary(roomId, { forceRefresh = false } = {}) {
    const existing = await getTranscriptSummary(roomId);
    if (existing && !forceRefresh) return existing;

    const segments = await getTranscriptSegments(roomId);
    const summary = await generateMeetingSummary({ roomId, segments });
    await setTranscriptSummary(roomId, summary);
    return summary;
}
