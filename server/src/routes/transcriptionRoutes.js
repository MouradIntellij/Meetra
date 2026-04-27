import express from 'express';
import { getTranscriptSegments, getTranscriptState } from '../services/transcription/transcriptStore.js';
import { buildMeetingSummary } from '../services/transcription/transcriptSummaryService.js';
import { appendTranscriptAudit } from '../services/transcription/transcriptAuditService.js';
import { canAccessTranscript, canExportTranscript } from '../services/transcription/transcriptAccessService.js';
import { getTranscriptionCapabilities } from '../services/transcription/transcriptionProvider.js';

function getRequesterId(req) {
    return req.header('x-requester-id') || req.query.requesterId || '';
}

export function createTranscriptionRouter() {
    const router = express.Router();

    router.get('/transcription/capabilities', (_req, res) => {
        res.json(getTranscriptionCapabilities());
    });

    router.get('/rooms/:roomId/transcript', async (req, res) => {
        const { roomId } = req.params;
        const requesterId = getRequesterId(req);
        if (!canAccessTranscript(roomId, requesterId)) {
            appendTranscriptAudit({ action: 'transcript.read.denied', roomId, requesterId });
            return res.status(403).json({ error: 'TRANSCRIPT_ACCESS_DENIED' });
        }

        const state = await getTranscriptState(roomId);
        appendTranscriptAudit({ action: 'transcript.read', roomId, requesterId, segmentCount: state.segments.length });

        res.json({
            roomId,
            active: state.active,
            language: state.language,
            startedAt: state.startedAt,
            segments: await getTranscriptSegments(roomId),
        });
    });

    router.get('/rooms/:roomId/transcript.txt', async (req, res) => {
        const { roomId } = req.params;
        const requesterId = getRequesterId(req);
        if (!canExportTranscript(roomId, requesterId)) {
            appendTranscriptAudit({ action: 'transcript.export.denied', roomId, requesterId });
            return res.status(403).json({ error: 'TRANSCRIPT_EXPORT_DENIED' });
        }

        const segments = await getTranscriptSegments(roomId);
        appendTranscriptAudit({ action: 'transcript.export', roomId, requesterId, segmentCount: segments.length });
        const mode = req.query.mode === 'bilingual' ? 'bilingual' : 'default';

        const text = segments
            .map((segment) => {
                const baseLine = `[${new Date(segment.createdAt).toLocaleTimeString()}] ${segment.speakerName}: ${segment.text}`;
                if (mode !== 'bilingual') return baseLine;

                const extraLines = [
                    segment.translations?.fr && segment.translations.fr !== segment.text
                        ? `  FR: ${segment.translations.fr}`
                        : null,
                    segment.translations?.en && segment.translations.en !== segment.text
                        ? `  EN: ${segment.translations.en}`
                        : null,
                ].filter(Boolean);

                return [baseLine, ...extraLines].join('\n');
            })
            .join('\n');

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${mode === 'bilingual' ? `transcript-bilingual-${roomId}` : `transcript-${roomId}`}.txt"`);
        res.send(text);
    });

    router.get('/rooms/:roomId/transcript/summary', async (req, res) => {
        const { roomId } = req.params;
        const requesterId = getRequesterId(req);
        if (!canAccessTranscript(roomId, requesterId)) {
            appendTranscriptAudit({ action: 'summary.read.denied', roomId, requesterId });
            return res.status(403).json({ error: 'SUMMARY_ACCESS_DENIED' });
        }

        const forceRefresh = req.query.refresh === '1';
        const summary = await buildMeetingSummary(roomId, { forceRefresh });
        appendTranscriptAudit({ action: forceRefresh ? 'summary.refresh' : 'summary.read', roomId, requesterId });
        res.json(summary);
    });

    return router;
}
