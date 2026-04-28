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
import { translateTranscriptSegment } from '../../services/transcription/translationProvider.js';

export function registerTranscriptionHandlers(io, socket) {
    socket.on(EVENTS.TRANSCRIPTION_START, async ({ roomId, language }) => {
        try {
            const state = await startTranscript(roomId, { language });
            logger.socket(EVENTS.TRANSCRIPTION_START, { roomId, language: state.language, by: socket.id });
            io.to(roomId).emit(EVENTS.TRANSCRIPTION_STATE, {
                active: true,
                language: state.language,
                startedAt: state.startedAt,
            });
        } catch (error) {
            logger.warn('Transcription start failed', {
                roomId,
                language,
                by: socket.id,
                message: error?.message || 'échec de démarrage',
            });
            socket.emit(EVENTS.TRANSCRIPTION_ERROR, {
                message: `Démarrage transcription: ${error?.message || 'échec de démarrage'}`,
            });
        }
    });

    socket.on(EVENTS.TRANSCRIPTION_STOP, async ({ roomId }) => {
        const state = await stopTranscript(roomId);
        logger.socket(EVENTS.TRANSCRIPTION_STOP, { roomId, by: socket.id });
        io.to(roomId).emit(EVENTS.TRANSCRIPTION_STATE, {
            active: false,
            language: state.language,
            startedAt: state.startedAt,
        });
    });

    socket.on(EVENTS.TRANSCRIPTION_SEGMENT, async ({ roomId, segment }) => {
        if (!roomId || !segment?.text?.trim()) return;

        const translations = segment.isFinal
            ? await translateTranscriptSegment({
                text: segment.text,
                sourceLanguage: segment.language,
            })
            : {};

        const normalized = await appendTranscriptSegment(roomId, {
            ...segment,
            speakerId: segment.speakerId || socket.id,
            translations,
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

            const normalized = await appendTranscriptSegment(roomId, {
                speakerId: chunk.speakerId || socket.id,
                speakerName: chunk.speakerName || 'Participant',
                text: result.text.trim(),
                translations: await translateTranscriptSegment({
                    text: result.text.trim(),
                    sourceLanguage: chunk.language,
                }),
                isFinal: true,
                language: chunk.language,
                startMs: chunk.startMs ?? Date.now(),
                endMs: chunk.endMs ?? Date.now(),
            });

            io.to(roomId).emit(EVENTS.TRANSCRIPTION_SEGMENT, normalized);
        } catch (error) {
            logger.warn('Transcription audio chunk failed', {
                roomId,
                speakerId: chunk.speakerId || socket.id,
                mimeType: chunk.mimeType,
                language: chunk.language,
                message: error?.message || 'échec de transcription',
            });
            socket.emit(EVENTS.TRANSCRIPTION_ERROR, {
                message: `STT serveur: ${error?.message || 'échec de transcription'}`,
            });
        }
    });

    socket.on('transcription-clear', async ({ roomId }) => {
        await clearTranscript(roomId);
        const state = await getTranscriptState(roomId);
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
