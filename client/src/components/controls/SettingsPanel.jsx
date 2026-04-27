import { useEffect, useMemo, useState } from 'react';
import { useMedia } from '../../context/MediaContext.jsx';
import { useTranscription } from '../../context/TranscriptionContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { CameraOffIcon, ChatBubbleIcon, ComputerIcon, MicOffIcon, SettingsIcon, TranscriptIcon } from '../common/AppIcons.jsx';
import ModalFrame from '../common/ModalFrame.jsx';

function SettingBlock({ icon, title, description, children }) {
  return (
    <section className="meetra-surface-soft rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Label({ children }) {
  return <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{children}</label>;
}

function SelectField({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="meetra-focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-400"
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.05]"
    >
      <div className="pr-4">
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export default function SettingsPanel() {
  const { settingsOpen, setSettingsOpen } = useUI();
  const {
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    availableDevices,
    selectedAudioInputId,
    selectedVideoInputId,
    replaceMediaDevices,
    refreshAvailableDevices,
    mediaAccessError,
  } = useMedia();
  const {
    captionsEnabled,
    setCaptionsEnabled,
    transcriptionActive,
    transcriptionMode,
    transcriptionProvider,
    language,
    setLanguage,
  } = useTranscription();

  const [audioInputId, setAudioInputId] = useState(selectedAudioInputId);
  const [videoInputId, setVideoInputId] = useState(selectedVideoInputId);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!settingsOpen) return;
    refreshAvailableDevices();
    setAudioInputId(selectedAudioInputId);
    setVideoInputId(selectedVideoInputId);
    setStatus('');
  }, [settingsOpen, refreshAvailableDevices, selectedAudioInputId, selectedVideoInputId]);

  const audioOptions = availableDevices.audioInputs;
  const videoOptions = availableDevices.videoInputs;
  const audioOutputLabel = useMemo(() => {
    if (!availableDevices.audioOutputs.length) return 'Sortie système par défaut';
    return availableDevices.audioOutputs[0]?.label || 'Sortie système détectée';
  }, [availableDevices.audioOutputs]);

  if (!settingsOpen) return null;

  const handleApplyDevices = async () => {
    setSaving(true);
    const ok = await replaceMediaDevices({
      audioDeviceId: audioInputId || undefined,
      videoDeviceId: videoInputId || undefined,
    });
    setSaving(false);
    setStatus(ok ? 'Périphériques appliqués.' : 'Impossible d’appliquer cette combinaison.');
  };

  return (
    <ModalFrame
      onClose={() => setSettingsOpen(false)}
      badge="Préférences de réunion"
      title="Paramètres Meetra"
      subtitle="Audio, vidéo, sous-titres et confort de réunion dans un seul panneau."
      icon={<SettingsIcon size={22} />}
      widthClass="max-w-4xl"
      bodyClassName="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
    >
          <div className="space-y-4">
            <SettingBlock
              icon={<MicOffIcon size={18} />}
              title="Périphériques audio et vidéo"
              description="Choisissez votre microphone et votre caméra actifs sans quitter la réunion."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Microphone</Label>
                  <SelectField value={audioInputId} onChange={(event) => setAudioInputId(event.target.value)}>
                    {audioOptions.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label>Caméra</Label>
                  <SelectField value={videoInputId} onChange={(event) => setVideoInputId(event.target.value)}>
                    {videoOptions.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Caméra ${index + 1}`}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Sortie audio</div>
                <div className="mt-1 text-xs text-slate-400">{audioOutputLabel}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleApplyDevices}
                  disabled={saving}
                  className="meetra-button meetra-button-primary meetra-focus-ring px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? 'Application...' : 'Appliquer les périphériques'}
                </button>
                <button
                  type="button"
                  onClick={refreshAvailableDevices}
                  className="meetra-button meetra-focus-ring px-4 py-3 text-sm font-semibold text-slate-200"
                >
                  Actualiser la liste
                </button>
              </div>
              {status && <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{status}</div>}
              {mediaAccessError && <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{mediaAccessError}</div>}
            </SettingBlock>

            <SettingBlock
              icon={<ComputerIcon size={18} />}
              title="État instantané"
              description="Contrôlez rapidement les flux actifs pendant la réunion."
            >
              <Toggle checked={audioEnabled} onChange={toggleAudio} label="Micro actif" hint="Coupez ou réactivez votre micro immédiatement." />
              <Toggle checked={videoEnabled} onChange={toggleVideo} label="Caméra active" hint="Bascule utile avant un partage ou une présentation." />
            </SettingBlock>
          </div>

          <div className="space-y-4">
            <SettingBlock
              icon={<TranscriptIcon size={18} />}
              title="Sous-titres et transcription"
              description="Ajustez le comportement des captions et la langue de transcription."
            >
              <Toggle
                checked={captionsEnabled}
                onChange={() => setCaptionsEnabled((current) => !current)}
                label="Afficher les sous-titres"
                hint={transcriptionActive ? 'Les sous-titres suivent la transcription active.' : 'Activez la transcription pour alimenter les sous-titres.'}
              />
              <div>
                <Label>Langue</Label>
                <SelectField value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="fr-CA">Français Canada</option>
                  <option value="fr-FR">Français France</option>
                  <option value="en-US">English US</option>
                </SelectField>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Moteur actuel</div>
                <div className="mt-1 text-xs text-slate-400">
                  {transcriptionMode === 'server'
                    ? `Serveur${transcriptionProvider === 'openai' ? ' · OpenAI' : ''}`
                    : 'Navigateur local'}
                </div>
              </div>
            </SettingBlock>

            <SettingBlock
              icon={<ChatBubbleIcon size={18} />}
              title="Confort de réunion"
              description="Préférences d’interface prévues pour les utilisateurs finaux."
            >
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-100">Notifications</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">
                  Les alertes de chat et d’admission apparaissent seulement si le navigateur a déjà accordé la permission.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-100">Profil recommandé</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">
                  Mode idéal pour Meetra: casque micro, caméra HD 720p, sous-titres activés seulement au besoin pour limiter la distraction visuelle.
                </div>
              </div>
            </SettingBlock>

            <SettingBlock
              icon={<CameraOffIcon size={18} />}
              title="À venir"
              description="Fondations déjà prêtes pour une version plus Teams/Zoom."
            >
              <ul className="space-y-2 text-sm text-slate-300">
                <li>Changement de haut-parleur de sortie quand le runtime le permet.</li>
                <li>Présets personnels de réunion et qualité vidéo préférée.</li>
                <li>Tests micro/caméra avant entrée dans la salle.</li>
              </ul>
            </SettingBlock>
          </div>
    </ModalFrame>
  );
}
