import { useEffect, useMemo, useState } from 'react';
import { useTranscription } from '../../context/TranscriptionContext.jsx';
import SummaryPanel from './SummaryPanel.jsx';
import { CloseIcon, TranscriptIcon } from '../common/AppIcons.jsx';

export default function TranscriptPanel() {
  const {
    transcriptOpen,
    setTranscriptOpen,
    segments,
    exportTranscript,
    transcriptionActive,
    startTranscription,
    stopTranscription,
    language,
    setLanguage,
    speechRecognitionSupported,
    error,
    transcriptionMode,
    transcriptionProvider,
    serverProviderAvailable,
    translationAvailable,
    translationProvider,
    translationTarget,
    setTranslationTarget,
    translationLabel,
    resolveSegmentText,
    diagnostics,
  } = useTranscription();
  const [query, setQuery] = useState('');
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1180 : false));

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1180);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const modeLabel =
    transcriptionMode === 'server'
      ? `Serveur${transcriptionProvider === 'openai' ? ' · OpenAI' : ''}`
      : 'Navigateur local';

  const filteredSegments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return segments;
    return segments.filter((segment) =>
      segment.text.toLowerCase().includes(normalized) ||
      Object.values(segment.translations || {}).some((value) => String(value || '').toLowerCase().includes(normalized)) ||
      segment.speakerName.toLowerCase().includes(normalized)
    );
  }, [segments, query]);

  if (!transcriptOpen) return null;

  return (
    <aside
      className={`meetra-surface flex flex-col border-l border-white/10 ${
        isCompact
          ? 'fixed inset-y-0 right-0 z-[95] w-full max-w-[380px]'
          : 'h-full w-[360px]'
      }`}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="meetra-section-label">Sous-titres</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-50">
              <TranscriptIcon size={16} />
              Transcription
            </div>
            <div className="mt-1 text-sm text-slate-400">Recherche, export et suivi du moteur en cours.</div>
          </div>
          <button
            type="button"
            onClick={() => setTranscriptOpen(false)}
            className="meetra-focus-ring rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">Moteur actif</div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] ${transcriptionMode === 'server' ? 'bg-emerald-500/16 text-emerald-100' : 'bg-blue-500/16 text-blue-100'}`}>
              {modeLabel}
            </span>
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-400">
            {transcriptionMode === 'server'
              ? 'Le micro est envoyé au serveur pour transcription centralisée.'
              : 'La transcription se fait localement dans le navigateur.'}
          </div>
          {transcriptionMode !== 'server' && (
            <div className="mt-2 text-[11px] text-slate-500">
              {serverProviderAvailable ? 'Un moteur serveur existe aussi, mais ce runtime utilise le mode local.' : 'Aucun provider serveur n’est configuré actuellement.'}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={transcriptionActive ? stopTranscription : startTranscription}
            disabled={transcriptionMode === 'browser' && !speechRecognitionSupported}
            className="meetra-button meetra-button-primary meetra-focus-ring px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {transcriptionActive ? 'Arrêter' : 'Démarrer'}
          </button>
          <button
            type="button"
            onClick={exportTranscript}
            className="meetra-button meetra-focus-ring px-4 py-3 text-sm font-semibold text-slate-100"
          >
            Exporter
          </button>
        </div>

        {transcriptionMode === 'browser' && !speechRecognitionSupported && (
          <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Ce navigateur ou runtime ne fournit pas `SpeechRecognition`. Configurez un provider serveur OpenAI pour activer la transcription ici.
          </div>
        )}

        {translationAvailable && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => exportTranscript('bilingual')}
              className="meetra-button meetra-focus-ring w-full px-4 py-3 text-sm font-semibold text-slate-100"
            >
              Exporter bilingue ({translationLabel})
            </button>
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans la transcription"
            className="meetra-focus-ring rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
          />
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="meetra-focus-ring rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
          >
            <option value="fr-CA">FR-CA</option>
            <option value="fr-FR">FR-FR</option>
            <option value="en-US">EN-US</option>
          </select>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-slate-400">
            {translationAvailable
              ? `Traduction live disponible via ${translationProvider === 'openai' ? 'OpenAI' : translationProvider}.`
              : 'Traduction live indisponible sans provider IA serveur.'}
          </div>
          <select
            value={translationTarget}
            onChange={(event) => setTranslationTarget(event.target.value)}
            disabled={!translationAvailable}
            className="meetra-focus-ring rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 disabled:opacity-40"
          >
            <option value="original">Original</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        {error && (
          <div className="mt-3 rounded-[16px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-3 rounded-[16px] border border-white/10 bg-slate-950/55 px-4 py-3 text-xs leading-6 text-slate-300">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Diagnostic transcription</div>
          <div>Socket: {diagnostics.connected ? 'connecté' : 'déconnecté'} {diagnostics.socketId ? `(${diagnostics.socketId})` : ''}</div>
          <div>Mode: {diagnostics.transcriptionMode} · Provider: {diagnostics.transcriptionProvider}</div>
          <div>Transcription active: {diagnostics.transcriptionActive ? 'oui' : 'non'}</div>
          <div>Local stream: {diagnostics.localStreamReady ? 'oui' : 'non'}</div>
          <div>Pistes audio: {diagnostics.audioTrackCount} · vidéo: {diagnostics.videoTrackCount}</div>
          <div>Micro enabled: {diagnostics.audioTrackEnabled === null ? 'absent' : diagnostics.audioTrackEnabled ? 'oui' : 'non'}</div>
          <div>Micro muted: {diagnostics.audioTrackMuted === null ? 'absent' : diagnostics.audioTrackMuted ? 'oui' : 'non'}</div>
          <div>Micro readyState: {diagnostics.audioTrackReadyState}</div>
          <div>Segments finaux reçus: {diagnostics.segmentCount}</div>
          <div>Segment live en cours: {diagnostics.hasLiveSegment ? 'oui' : 'non'}</div>
          <div>SpeechRecognition local: {diagnostics.speechRecognitionSupported ? 'oui' : 'non'}</div>
          {diagnostics.lastError && <div className="text-red-200">Dernière erreur: {diagnostics.lastError}</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {filteredSegments.length === 0 ? (
          <div className="meetra-empty-state">
            <h4>Transcription vide</h4>
            <p className="text-sm leading-6 text-slate-400">
              Les segments apparaîtront ici dès que la transcription sera active et que la réunion produira du contenu vocal.
            </p>
          </div>
        ) : (
          filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className="mb-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-blue-100">{segment.speakerName}</div>
                <div className="text-xs text-slate-500">{new Date(segment.createdAt).toLocaleTimeString()}</div>
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-100">{resolveSegmentText(segment)}</div>
              {translationTarget !== 'original' && resolveSegmentText(segment) !== segment.text && (
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  Original: {segment.text}
                </div>
              )}
            </div>
          ))
        )}

        <SummaryPanel />
      </div>
    </aside>
  );
}
