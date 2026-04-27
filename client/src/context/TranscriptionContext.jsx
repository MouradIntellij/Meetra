import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from './SocketContext.jsx';
import { EVENTS } from '../utils/events.js';
import { useMedia } from './MediaContext.jsx';

const TranscriptionContext = createContext(null);

export function useTranscription() {
    const ctx = useContext(TranscriptionContext);
    if (!ctx) throw new Error('useTranscription must be inside TranscriptionProvider');
    return ctx;
}

export function TranscriptionProvider({ roomId, userName, children }) {
    const { socket, connected, apiUrl } = useSocket();
    const { localStream } = useMedia();
    const translationPrefKey = 'meetra-translation-target';
    const [captionsEnabled, setCaptionsEnabled] = useState(true);
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    const [transcriptionActive, setTranscriptionActive] = useState(false);
    const [language, setLanguage] = useState('fr-CA');
    const [segments, setSegments] = useState([]);
    const [liveSegment, setLiveSegment] = useState(null);
    const [transcriptionMode, setTranscriptionMode] = useState('browser');
    const [transcriptionProvider, setTranscriptionProvider] = useState('browser');
    const [serverProviderAvailable, setServerProviderAvailable] = useState(false);
    const [translationAvailable, setTranslationAvailable] = useState(false);
    const [translationProvider, setTranslationProvider] = useState('none');
    const [translationTarget, setTranslationTarget] = useState(() => {
        if (typeof window === 'undefined') return 'original';
        return window.localStorage.getItem(translationPrefKey) || 'original';
    });
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [error, setError] = useState('');
    const recognitionRef = useRef(null);
    const recorderRef = useRef(null);
    const SpeechRecognition = typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    useEffect(() => {
        fetch(`${apiUrl}/api/transcription/capabilities`)
            .then((res) => res.json())
            .then((data) => {
                if (data?.preferredMode) {
                    setTranscriptionMode(data.preferredMode);
                }
                if (data?.provider) {
                    setTranscriptionProvider(data.provider);
                }
                setServerProviderAvailable(Boolean(data?.serverProviderAvailable));
                setTranslationAvailable(Boolean(data?.translationAvailable));
                if (data?.translationProvider) {
                    setTranslationProvider(data.translationProvider);
                }
            })
            .catch(() => {});
    }, [apiUrl]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(translationPrefKey, translationTarget);
    }, [translationTarget]);

    useEffect(() => {
        if (!roomId || !transcriptOpen) return;

        fetch(`${apiUrl}/api/rooms/${roomId}/transcript`, {
            headers: socket?.id ? { 'x-requester-id': socket.id } : {},
        })
            .then(async (res) => {
                if (res.status === 403) {
                    return null;
                }

                if (!res.ok) {
                    throw new Error(`TRANSCRIPT_LOAD_FAILED_${res.status}`);
                }

                return res.json();
            })
            .then((data) => {
                if (!data) return;
                setSegments(data.segments || []);
                setTranscriptionActive(Boolean(data.active));
                if (data.language) {
                    setLanguage(data.language);
                }
            })
            .catch(() => {});
    }, [roomId, apiUrl, socket?.id, transcriptOpen]);

    useEffect(() => {
        if (!socket) return;

        const onState = (payload) => {
            setTranscriptionActive(Boolean(payload.active));
            if (payload.language) setLanguage(payload.language);
            if (payload.cleared) {
                setSegments([]);
                setLiveSegment(null);
            }
        };

        const onSegment = (segment) => {
            if (segment.isFinal) {
                setSegments((current) => [...current, segment]);
                setLiveSegment((current) => current?.speakerId === segment.speakerId ? null : current);
                return;
            }

            setLiveSegment(segment);
        };

        const onError = (payload) => {
            setError(payload?.message || 'Erreur de transcription');
        };
        const onSummaryReady = (payload) => {
            setSummary(payload);
            setSummaryLoading(false);
        };

        socket.on(EVENTS.TRANSCRIPTION_STATE, onState);
        socket.on(EVENTS.TRANSCRIPTION_SEGMENT, onSegment);
        socket.on(EVENTS.TRANSCRIPTION_ERROR, onError);
        socket.on(EVENTS.TRANSCRIPTION_SUMMARY_READY, onSummaryReady);

        return () => {
            socket.off(EVENTS.TRANSCRIPTION_STATE, onState);
            socket.off(EVENTS.TRANSCRIPTION_SEGMENT, onSegment);
            socket.off(EVENTS.TRANSCRIPTION_ERROR, onError);
            socket.off(EVENTS.TRANSCRIPTION_SUMMARY_READY, onSummaryReady);
        };
    }, [socket]);

    useEffect(() => {
        if (
            transcriptionMode !== 'browser' ||
            !SpeechRecognition ||
            !socket ||
            !connected ||
            !transcriptionActive
        ) return;

        const recognition = new SpeechRecognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const text = result[0]?.transcript?.trim();
                if (!text) continue;

                socket.emit(EVENTS.TRANSCRIPTION_SEGMENT, {
                    roomId,
                    segment: {
                        speakerId: socket.id,
                        speakerName: userName || 'Vous',
                        text,
                        isFinal: result.isFinal,
                        language,
                        startMs: Date.now(),
                        endMs: Date.now(),
                    },
                });
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== 'aborted') {
                setError(`Reconnaissance vocale: ${event.error}`);
            }
        };

        recognition.onend = () => {
            if (transcriptionActive) {
                try {
                    recognition.start();
                } catch {}
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch {}

        return () => {
            recognitionRef.current = null;
            recognition.onend = null;
            try {
                recognition.stop();
            } catch {}
        };
    }, [SpeechRecognition, socket, connected, transcriptionActive, roomId, userName, language, transcriptionMode]);

    useEffect(() => {
        if (
            transcriptionMode !== 'server' ||
            !socket ||
            !connected ||
            !transcriptionActive ||
            !localStream
        ) return;

        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            setError('Aucune piste micro disponible pour la transcription serveur.');
            return;
        }

        const audioStream = new MediaStream([audioTracks[0]]);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
        const recorder = new MediaRecorder(audioStream, { mimeType });

        recorder.ondataavailable = async (event) => {
            if (!event.data || event.data.size === 0) return;

            const base64Audio = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = String(reader.result || '');
                    const payload = result.split(',')[1] || '';
                    resolve(payload);
                };
                reader.onerror = reject;
                reader.readAsDataURL(event.data);
            });

            socket.emit(EVENTS.TRANSCRIPTION_AUDIO_CHUNK, {
                roomId,
                chunk: {
                    speakerId: socket.id,
                    speakerName: userName || 'Vous',
                    base64Audio,
                    mimeType: event.data.type || mimeType,
                    language,
                    startMs: Date.now(),
                    endMs: Date.now(),
                },
            });
        };

        recorderRef.current = recorder;
        recorder.start(4000);

        return () => {
            recorderRef.current = null;
            if (recorder.state !== 'inactive') {
                recorder.stop();
            }
        };
    }, [transcriptionMode, socket, connected, transcriptionActive, roomId, userName, language, localStream]);

    const startTranscription = () => {
        if (!socket) return;
        setError('');

        if (transcriptionMode === 'browser' && !SpeechRecognition) {
            setError('Reconnaissance vocale non disponible dans ce runtime.');
            return;
        }

        socket.emit(EVENTS.TRANSCRIPTION_START, { roomId, language });
    };

    const stopTranscription = () => {
        if (!socket) return;
        socket.emit(EVENTS.TRANSCRIPTION_STOP, { roomId });
    };

    const exportTranscript = (mode = 'default') => {
        const requesterId = socket?.id ? `?requesterId=${encodeURIComponent(socket.id)}` : '';
        const params = new URLSearchParams();
        if (socket?.id) {
            params.set('requesterId', socket.id);
        }
        if (mode === 'bilingual') {
            params.set('mode', 'bilingual');
        }
        const query = params.toString();
        window.open(`${apiUrl}/api/rooms/${roomId}/transcript.txt${query ? `?${query}` : ''}`, '_blank', 'noopener,noreferrer');
    };

    const generateSummary = () => {
        if (!socket) return;
        setSummaryLoading(true);
        socket.emit('transcription-generate-summary', { roomId, refresh: true });
    };

    const refreshSummary = () => {
        setSummaryLoading(true);
        fetch(`${apiUrl}/api/rooms/${roomId}/transcript/summary?refresh=1`, {
            headers: socket?.id ? { 'x-requester-id': socket.id } : {},
        })
            .then((res) => res.json())
            .then((data) => setSummary(data))
            .catch(() => setError('Impossible de charger le résumé.'))
            .finally(() => setSummaryLoading(false));
    };

    const visibleCaptions = useMemo(() => {
        if (!captionsEnabled) return null;
        return liveSegment || segments[segments.length - 1] || null;
    }, [captionsEnabled, liveSegment, segments]);

    const resolveSegmentText = (segment) => {
        if (!segment) return '';
        if (translationTarget === 'original') return segment.text || '';
        return segment.translations?.[translationTarget] || segment.text || '';
    };

    const translationLabel =
        translationTarget === 'fr'
            ? 'FR'
            : translationTarget === 'en'
                ? 'EN'
                : 'Original';

    const cycleTranslationTarget = () => {
        setTranslationTarget((current) => {
            if (current === 'original') return 'fr';
            if (current === 'fr') return 'en';
            return 'original';
        });
    };

    return (
        <TranscriptionContext.Provider value={{
            captionsEnabled,
            setCaptionsEnabled,
            transcriptOpen,
            setTranscriptOpen,
            transcriptionActive,
            startTranscription,
            stopTranscription,
            segments,
            liveSegment,
            visibleCaptions,
            exportTranscript,
            summary,
            summaryLoading,
            generateSummary,
            refreshSummary,
            language,
            setLanguage,
            error,
            transcriptionMode,
            transcriptionProvider,
            serverProviderAvailable,
            translationAvailable,
            translationProvider,
            translationTarget,
            setTranslationTarget,
            translationLabel,
            cycleTranslationTarget,
            resolveSegmentText,
            speechRecognitionSupported: Boolean(SpeechRecognition),
        }}>
            {children}
        </TranscriptionContext.Provider>
    );
}
