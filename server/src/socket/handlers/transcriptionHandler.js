import { EVENTS } from '../../constants/events.js';
import { logger } from '../../utils/logger.js';
import {
    appendTranscriptSegment,
    clearTranscript,
    getTranscriptState,
    startTranscript,
    stopTranscript,
} from '../../services/transcription/transcriptStore.js';
import { buildMeetingSummary } from '../../services/transcription/transcriptSummaryService.js';
import { transcribeAudioChunk } from '../../services/transcription/transcriptionProvider.js';

export function registerTranscriptionHandlers(io, socket) {
    socket.on(EVENTS.TRANSCRIPTION_START, ({ roomId, language }) => {
        const state = startTranscript(roomId, { language });
        logger.socket(EVENTS.TRANSCRIPTION_START, { roomId, language: state.language, by: socket.id });
        io.to(roomId).emit(EVENTS.TRANSCRIPTION_STATE, {
            active: true,
            language: state.language,
            startedAt: state.startedAt,
        });
    });

    socket.on(EVENTS.TRANSCRIPTION_STOP, ({ roomId }) => {
        const state = stopTranscript(roomId);
        logger.socket(EVENTS.TRANSCRIPTION_STOP, { roomId, by: socket.id });
        io.to(roomId).emit(EVENTS.TRANSCRIPTION_STATE, {
            active: false,
            language: state.language,
            startedAt: state.startedAt,
        });
    });

    socket.on(EVENTS.TRANSCRIPTION_SEGMENT, ({ roomId, segment }) => {
        if (!roomId || !segment?.text?.trim()) return;

        const normalized = appendTranscriptSegment(roomId, {
            ...segment,
            speakerId: segment.speakerId || socket.id,
        });

        io.to(roomId).emit(EVENTS.TRANSCRIPTION_SEGMENT, normalized);
    });

    socket.on(EVENTS.TRANSCRIPTION_AUDIO_CHUNK, async ({ roomId, chunk }) => {
        if (!roomId || !chunk?.base64Audio) return;

        try {
            const result = await transcribeAudioChunk({
                base64Audio: chunk.base64Audio,
                mimeType: chunk.mimeType,
                language: chunk.language,
            });

            if (!result?.text?.trim()) return;

            const normalized = appendTranscriptSegment(roomId, {
                speakerId: chunk.speakerId || socket.id,
                speakerName: chunk.speakerName || 'Participant',
                text: result.text.trim(),
                isFinal: true,
                language: chunk.language,
                startMs: chunk.startMs ?? Date.now(),
                endMs: chunk.endMs ?? Date.now(),
            });

            io.to(roomId).emit(EVENTS.TRANSCRIPTION_SEGMENT, normalized);
        } catch (error) {
            socket.emit(EVENTS.TRANSCRIPTION_ERROR, {
                message: `STT serveur: ${error?.message || 'échec de transcription'}`,
            });
        }
    });

    socket.on('transcription-clear', ({ roomId }) => {
        clearTranscript(roomId);
        const state = getTranscriptState(roomId);
        io.to(roomId).emit(EVENTS.TRANSCRIPTION_STATE, {
            active: state.active,
            language: state.language,
            startedAt: state.startedAt,
            cleared: true,
        });
    });

    socket.on('transcription-generate-summary', async ({ roomId, refresh }) => {
        const summary = await buildMeetingSummary(roomId, { forceRefresh: Boolean(refresh) });
        io.to(roomId).emit(EVENTS.TRANSCRIPTION_SUMMARY_READY, summary);
    });
}
