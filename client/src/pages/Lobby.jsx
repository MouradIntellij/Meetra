import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { EVENTS }   from '../utils/events.js';
import { getApiUrl } from '../utils/appConfig.js';
import { createAudioAnalyser } from '../utils/audioLevel.js';

const API_URL = getApiUrl();
const AUDIO_DEVICE_STORAGE_KEY = 'meetra-preferred-audio-input';
const VIDEO_DEVICE_STORAGE_KEY = 'meetra-preferred-video-input';
const AUDIO_ENABLED_STORAGE_KEY = 'meetra-preferred-audio-enabled';
const VIDEO_ENABLED_STORAGE_KEY = 'meetra-preferred-video-enabled';

function readStoredValue(key, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function readStoredBool(key, fallback = true) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value !== 'false';
}

function persistValue(key, value) {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(key, value);
    return;
  }
  window.localStorage.removeItem(key);
}

function persistBool(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(value));
}

function isRecoverableDeviceError(error) {
  const name = String(error?.name || '');
  return (
    name === 'NotFoundError'
    || name === 'OverconstrainedError'
    || name === 'NotReadableError'
    || name === 'AbortError'
  );
}

function buildPreviewConstraints({ audioDeviceId = '', videoDeviceId = '', nextAudioEnabled = true, nextVideoEnabled = true }) {
  const wantsAudio = Boolean(audioDeviceId) || nextAudioEnabled;
  const wantsVideo = Boolean(videoDeviceId) || nextVideoEnabled;

  return {
    video: wantsVideo ? {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
      ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
    } : false,
    audio: wantsAudio ? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
    } : false,
  };
}

// ─── Icônes SVG ───────────────────────────────────────────────
const MicOnIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8"  y1="23" x2="16" y2="23"/>
    </svg>
);

const MicOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8"  y1="23" x2="16" y2="23"/>
    </svg>
);

const CamOnIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
);

const CamOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
      <path d="M23 7l-7 5 7 5V7z"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

const ArrowLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
);

const UsersIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);

const CrownIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 20h20v2H2zM4 17l4-8 4 4 4-8 4 8H4z"/>
    </svg>
);

const ClockIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
);

// ─── Couleurs d'avatar déterministes ─────────────────────────
const AVATAR_PALETTES = [
  { bg: '#1a3a5c', text: '#60a5fa' },
  { bg: '#1a2e1a', text: '#4ade80' },
  { bg: '#3a1a2e', text: '#f472b6' },
  { bg: '#2e2a1a', text: '#fbbf24' },
  { bg: '#1a2a3a', text: '#818cf8' },
  { bg: '#3a1a1a', text: '#f87171' },
];

function getAvatarPalette(name) {
  const idx = name ? name.charCodeAt(0) % AVATAR_PALETTES.length : 0;
  return AVATAR_PALETTES[idx];
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 36, showRing = false }) {
  const { bg, text } = getAvatarPalette(name || '');
  return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color: text, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 700,
        letterSpacing: '-0.02em',
        outline: showRing ? `2px solid ${text}` : 'none',
        outlineOffset: 2,
        fontFamily: "'DM Mono', monospace",
      }}>
        {name?.[0]?.toUpperCase() ?? '?'}
      </div>
  );
}

// ─── Pill statut (micro ou cam) ───────────────────────────────
function StatusPill({ on, IconOn, IconOff, labelOn, labelOff }) {
  return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 20,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
        background: on ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
        color:      on ? '#4ade80'               : '#f87171',
        border: `1px solid ${on ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
      }}>
        {on ? <IconOn /> : <IconOff />}
        {on ? labelOn : labelOff}
      </div>
  );
}

// ─── Ligne participant dans la liste ──────────────────────────
function ParticipantRow({ p, isHost, isLast }) {
  return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Avatar + badge hôte */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar name={p.name} size={34} />
          {isHost && (
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid #0d1117',
              }}>
                <CrownIcon />
              </div>
          )}
        </div>

        {/* Nom */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#e2e8f0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.name}
          </div>
          {isHost && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 1, fontWeight: 500 }}>
                Hôte de la réunion
              </div>
          )}
        </div>

        {/* Statuts */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: p.audioEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
            color:      p.audioEnabled ? '#4ade80'                : '#f87171',
          }}>
            {p.audioEnabled ? <MicOnIcon /> : <MicOffIcon />}
          </div>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: p.videoEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
            color:      p.videoEnabled ? '#4ade80'                : '#f87171',
          }}>
            {p.videoEnabled ? <CamOnIcon /> : <CamOffIcon />}
          </div>
        </div>
      </div>
  );
}

// ─── Bouton toggle micro/cam ──────────────────────────────────
function MediaToggleBtn({ on, onToggle, IconOn, IconOff, label }) {
  const [hover, setHover] = useState(false);
  return (
      <button
          onClick={onToggle}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            flex: 1, padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
            border: `1px solid ${on
                ? (hover ? 'rgba(74,222,128,0.4)'  : 'rgba(74,222,128,0.2)')
                : (hover ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.2)')}`,
            background: on
                ? (hover ? 'rgba(74,222,128,0.15)'  : 'rgba(74,222,128,0.08)')
                : (hover ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.08)'),
            color:  on ? '#4ade80' : '#f87171',
            transition: 'all 0.18s ease',
            transform: hover ? 'translateY(-1px)' : 'none',
            fontFamily: 'inherit',
          }}
      >
        {on ? <IconOn /> : <IconOff />}
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>
        {on ? label : label + ' OFF'}
      </span>
      </button>
  );
}

// ─── Composant principal Lobby ────────────────────────────────
export default function Lobby({ roomId, userName, onJoin, onBack }) {
  const { socket } = useSocket();

  // Flux média local (preview)
  const [stream,        setStream]        = useState(null);
  const [audioEnabled,  setAudioEnabled]  = useState(() => readStoredBool(AUDIO_ENABLED_STORAGE_KEY, true));
  const [videoEnabled,  setVideoEnabled]  = useState(() => readStoredBool(VIDEO_ENABLED_STORAGE_KEY, true));
  const [mediaError,    setMediaError]    = useState('');
  const [availableDevices, setAvailableDevices] = useState({ audioInputs: [], videoInputs: [] });
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(() => readStoredValue(AUDIO_DEVICE_STORAGE_KEY, ''));
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(() => readStoredValue(VIDEO_DEVICE_STORAGE_KEY, ''));
  const [applyingDevices, setApplyingDevices] = useState(false);
  const [refreshingDevices, setRefreshingDevices] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState('');
  const [playingSpeakerTest, setPlayingSpeakerTest] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('unknown');
  const [networkStats, setNetworkStats] = useState({ effectiveType: '', downlink: null, rtt: null });

  // Participants déjà dans la salle
  const [participants,  setParticipants]  = useState([]);
  const [hostId,        setHostId]        = useState(null);
  const [roomLocked,    setRoomLocked]    = useState(false);
  const [loadingPeers,  setLoadingPeers]  = useState(true);

  // UI
  const [joining,       setJoining]       = useState(false);
  const [waitSecs,      setWaitSecs]      = useState(0);
  const [rejected,      setRejected]      = useState('');

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);
  const cleanupAudioRef = useRef(null);
  const speakerTestTimerRef = useRef(null);
  const preserveStreamOnUnmountRef = useRef(false);

  const persistPreviewPreferences = useCallback((nextAudioEnabled, nextVideoEnabled, audioDeviceId, videoDeviceId) => {
    persistBool(AUDIO_ENABLED_STORAGE_KEY, nextAudioEnabled);
    persistBool(VIDEO_ENABLED_STORAGE_KEY, nextVideoEnabled);
    persistValue(AUDIO_DEVICE_STORAGE_KEY, audioDeviceId);
    persistValue(VIDEO_DEVICE_STORAGE_KEY, videoDeviceId);
  }, []);

  const syncDeviceInventory = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((item) => item.kind === 'audioinput');
    const videoInputs = devices.filter((item) => item.kind === 'videoinput');
    setAvailableDevices({ audioInputs, videoInputs });

    setSelectedAudioInputId((current) => current || audioInputs[0]?.deviceId || '');
    setSelectedVideoInputId((current) => current || videoInputs[0]?.deviceId || '');
  }, []);

  const attachPreviewStream = useCallback((nextStream, nextAudioEnabled, nextVideoEnabled) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    cleanupAudioRef.current?.();

    const audioTrack = nextStream?.getAudioTracks?.()[0];
    const videoTrack = nextStream?.getVideoTracks?.()[0];

    if (audioTrack) {
      audioTrack.enabled = nextAudioEnabled;
    }
    if (videoTrack) {
      videoTrack.enabled = nextVideoEnabled;
    }

    streamRef.current = nextStream;
    setStream(nextStream);
    setAudioEnabled(Boolean(audioTrack?.enabled ?? nextAudioEnabled));
    setVideoEnabled(Boolean(videoTrack?.enabled ?? nextVideoEnabled));
    setMediaError('');
    setAudioLevel(0);

    cleanupAudioRef.current = createAudioAnalyser(nextStream, (level) => {
      setAudioLevel(Math.min(100, Math.round((level / 255) * 100)));
    });
  }, []);

  const openPreviewStream = useCallback(async ({
    audioDeviceId = selectedAudioInputId,
    videoDeviceId = selectedVideoInputId,
    nextAudioEnabled = audioEnabled,
    nextVideoEnabled = videoEnabled,
  } = {}) => {
    try {
      let nextStream;

      try {
        nextStream = await navigator.mediaDevices.getUserMedia(
          buildPreviewConstraints({ audioDeviceId, videoDeviceId, nextAudioEnabled, nextVideoEnabled })
        );
      } catch (error) {
        // Stored device ids can become stale after unplug/reboot; retry with default devices.
        if (!isRecoverableDeviceError(error) || (!audioDeviceId && !videoDeviceId)) {
          throw error;
        }

        persistValue(AUDIO_DEVICE_STORAGE_KEY, '');
        persistValue(VIDEO_DEVICE_STORAGE_KEY, '');
        setSelectedAudioInputId('');
        setSelectedVideoInputId('');

        nextStream = await navigator.mediaDevices.getUserMedia(
          buildPreviewConstraints({
            audioDeviceId: '',
            videoDeviceId: '',
            nextAudioEnabled,
            nextVideoEnabled,
          })
        );
      }

      attachPreviewStream(nextStream, nextAudioEnabled, nextVideoEnabled);
      await syncDeviceInventory();
      const resolvedAudioId = nextStream.getAudioTracks?.()[0]?.getSettings?.().deviceId || '';
      const resolvedVideoId = nextStream.getVideoTracks?.()[0]?.getSettings?.().deviceId || '';
      if (resolvedAudioId) setSelectedAudioInputId(resolvedAudioId);
      if (resolvedVideoId) setSelectedVideoInputId(resolvedVideoId);
      persistPreviewPreferences(nextAudioEnabled, nextVideoEnabled, resolvedAudioId, resolvedVideoId);
      return true;
    } catch {
      await syncDeviceInventory().catch(() => {});
      streamRef.current = null;
      cleanupAudioRef.current?.();
      cleanupAudioRef.current = null;
      setStream(null);
      setAudioLevel(0);
      setAudioEnabled(false);
      setVideoEnabled(false);
      setMediaError("Impossible d'accéder à la caméra ou au micro.\nVous pouvez continuer et rejoindre la salle sans vidéo.");
      persistPreviewPreferences(false, false, audioDeviceId, videoDeviceId);
      return false;
    }
  }, [attachPreviewStream, audioEnabled, persistPreviewPreferences, selectedAudioInputId, selectedVideoInputId, syncDeviceInventory, videoEnabled]);

  // ── 1. Ouvrir la caméra ───────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      await syncDeviceInventory().catch(() => {});
      const ok = await openPreviewStream({
        audioDeviceId: selectedAudioInputId,
        videoDeviceId: selectedVideoInputId,
        nextAudioEnabled: readStoredBool(AUDIO_ENABLED_STORAGE_KEY, true),
        nextVideoEnabled: readStoredBool(VIDEO_ENABLED_STORAGE_KEY, true),
      });
      if (!alive && ok) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
      }
    })();
    return () => {
      alive = false;
      cleanupAudioRef.current?.();
      if (!preserveStreamOnUnmountRef.current) {
        streamRef.current?.getTracks().forEach(t => t.stop());
      }
    };
  }, [openPreviewStream, selectedAudioInputId, selectedVideoInputId]);

  // ── 2. Attacher le stream à la balise <video> ─────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) { el.srcObject = stream; el.play().catch(() => {}); }
  }, [stream]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return undefined;
    navigator.mediaDevices.addEventListener('devicechange', syncDeviceInventory);
    return () => navigator.mediaDevices.removeEventListener('devicechange', syncDeviceInventory);
  }, [syncDeviceInventory]);

  useEffect(() => {
    if (!navigator.connection) return undefined;

    const updateConnection = () => {
      const connection = navigator.connection;
      const effectiveType = connection?.effectiveType || '';
      const downlink = typeof connection?.downlink === 'number' ? connection.downlink : null;
      const rtt = typeof connection?.rtt === 'number' ? connection.rtt : null;

      setNetworkStats({ effectiveType, downlink, rtt });

      if (effectiveType === '4g' || (downlink !== null && downlink >= 8)) {
        setNetworkQuality('good');
      } else if (effectiveType === '3g' || (downlink !== null && downlink >= 2)) {
        setNetworkQuality('fair');
      } else if (effectiveType) {
        setNetworkQuality('poor');
      } else {
        setNetworkQuality('unknown');
      }
    };

    updateConnection();
    navigator.connection.addEventListener('change', updateConnection);
    return () => navigator.connection?.removeEventListener('change', updateConnection);
  }, []);

  // ── 3. Charger les participants via REST ──────────────────
  useEffect(() => {
    setLoadingPeers(true);
    fetch(`${API_URL}/api/rooms/${roomId}/participants`)
        .then(r => r.json())
        .then(data => {
          setParticipants(data.participants || []);
          setHostId(data.hostId || null);
          setRoomLocked(data.locked || false);
        })
        .catch(() => {})
        .finally(() => setLoadingPeers(false));
  }, [roomId]);

  // ── 4. Timer d'attente ────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Helpers ───────────────────────────────────────────────
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
  };

  const cleanup = useCallback((preserveStream = false) => {
    clearInterval(timerRef.current);
    clearTimeout(speakerTestTimerRef.current);
    cleanupAudioRef.current?.();
    preserveStreamOnUnmountRef.current = preserveStream;
    if (!preserveStream) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    const nextEnabled = track ? !track.enabled : !audioEnabled;
    if (track) {
      track.enabled = nextEnabled;
    }
    setAudioEnabled(nextEnabled);
    persistBool(AUDIO_ENABLED_STORAGE_KEY, nextEnabled);
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    const nextEnabled = track ? !track.enabled : !videoEnabled;
    if (track) {
      track.enabled = nextEnabled;
    }
    setVideoEnabled(nextEnabled);
    persistBool(VIDEO_ENABLED_STORAGE_KEY, nextEnabled);
  }, [videoEnabled]);

  const handleRefreshDevices = useCallback(async () => {
    setRefreshingDevices(true);
    try {
      await syncDeviceInventory();
      setDeviceStatus('Périphériques actualisés.');
    } catch {
      setDeviceStatus("Impossible d'actualiser la liste pour le moment.");
    } finally {
      setRefreshingDevices(false);
    }
  }, [syncDeviceInventory]);

  const handleApplyDevices = useCallback(async () => {
    setApplyingDevices(true);
    setDeviceStatus('');
    const ok = await openPreviewStream({
      audioDeviceId: selectedAudioInputId,
      videoDeviceId: selectedVideoInputId,
      nextAudioEnabled: audioEnabled,
      nextVideoEnabled: videoEnabled,
    });
    setApplyingDevices(false);
    setDeviceStatus(ok ? 'Pré-test mis à jour avec ces périphériques.' : "Impossible d'utiliser cette combinaison.");
  }, [audioEnabled, openPreviewStream, selectedAudioInputId, selectedVideoInputId, videoEnabled]);

  const handleSpeakerTest = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        setDeviceStatus('Test haut-parleur indisponible sur ce navigateur.');
        return;
      }

      clearTimeout(speakerTestTimerRef.current);
      setPlayingSpeakerTest(true);
      setDeviceStatus('Lecture d’un son de test sur vos haut-parleurs.');

      const audioContext = new AudioCtx();
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      masterGain.connect(audioContext.destination);

      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, index) => {
        const startAt = audioContext.currentTime + (index * 0.18);
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.17);
      });

      speakerTestTimerRef.current = setTimeout(async () => {
        setPlayingSpeakerTest(false);
        setDeviceStatus('Si vous avez entendu la sonnerie, vos haut-parleurs sont prêts.');
        await audioContext.close();
      }, 800);
    } catch {
      setPlayingSpeakerTest(false);
      setDeviceStatus("Impossible de jouer le son de test sur cet appareil.");
    }
  }, []);

  // ── Clic sur Start / Rejoindre ────────────────────────────
  const handleJoin = useCallback(() => {
    if (joining) return;
    setJoining(true);
    const stream = streamRef.current;
    cleanup(true);
    onJoin(stream);
  }, [joining, cleanup, onJoin]);

  // ── Retour ────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    cleanup();
    onBack();
  }, [cleanup, onBack]);

  // ─────────────────────────────────────────────────────────
  const isFirstUser = participants.length === 0 && !loadingPeers;
  const btnLabel    = joining
      ? '⏳ Connexion…'
      : isFirstUser
          ? '🚀 Démarrer la réunion'
          : `✓ Rejoindre (${participants.length} présent${participants.length > 1 ? 's' : ''})`;
  const speakingNow = audioEnabled && audioLevel >= 18;
  const selectedAudioLabel = availableDevices.audioInputs.find((device) => device.deviceId === selectedAudioInputId)?.label || (selectedAudioInputId ? 'Microphone sélectionné' : 'Microphone par défaut');
  const selectedVideoLabel = availableDevices.videoInputs.find((device) => device.deviceId === selectedVideoInputId)?.label || (selectedVideoInputId ? 'Caméra sélectionnée' : 'Caméra par défaut');
  const previewReady = Boolean(stream || mediaError);
  const mediaReady = Boolean(stream) || Boolean(mediaError);
  const checklist = [
    {
      label: 'Réseau',
      ok: networkQuality !== 'poor',
      detail: networkQuality === 'good'
        ? 'Connexion solide'
        : networkQuality === 'fair'
          ? 'Connexion correcte'
          : networkQuality === 'poor'
            ? 'Connexion fragile'
            : 'État non exposé par le navigateur',
    },
    {
      label: 'Micro',
      ok: !audioEnabled || audioLevel > 0 || Boolean(stream?.getAudioTracks?.().length),
      detail: audioEnabled ? (speakingNow ? 'Voix détectée' : 'En écoute') : 'Désactivé volontairement',
    },
    {
      label: 'Caméra',
      ok: !videoEnabled || Boolean(stream?.getVideoTracks?.().length),
      detail: videoEnabled ? 'Source prête' : 'Désactivée volontairement',
    },
  ];
  const failingChecks = checklist.filter((item) => !item.ok).length;
  const readinessTone = !previewReady
    ? { label: 'Préparation en cours', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.22)' }
    : failingChecks === 0
      ? { label: 'Prêt à rejoindre', color: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(74,222,128,0.22)' }
      : { label: 'Prêt avec limites', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.22)' };

  return (
      <div style={{
        minHeight: '100vh',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      }}>

        {/* Fond subtil */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `
          radial-gradient(ellipse 60% 40% at 20% 50%, rgba(30,58,138,0.15) 0%, transparent 70%),
          radial-gradient(ellipse 50% 35% at 80% 50%, rgba(88,28,135,0.10) 0%, transparent 70%)
        `,
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 900,
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 16,
          alignItems: 'start',
        }}>

          {/* ══════════════════════════════════════════════════
            COLONNE GAUCHE — Preview caméra + contrôles
        ══════════════════════════════════════════════════ */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, overflow: 'hidden',
          }}>

            {/* Barre du haut */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <button
                  onClick={handleBack}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '5px 12px',
                    color: 'rgba(255,255,255,0.55)', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              >
                <ArrowLeftIcon /> Retour
              </button>

              <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase',
              }}>
                Salle d'attente
              </span>
              </div>

              {/* Timer */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '4px 10px',
              }}>
                <ClockIcon />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                {fmtTime(waitSecs)}
              </span>
              </div>
            </div>

            {/* Preview cam */}
            <div style={{
              position: 'relative',
              aspectRatio: '16/9',
              background: '#080c14',
              overflow: 'hidden',
            }}>
              <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    opacity: (stream && videoEnabled) ? 1 : 0,
                    transition: 'opacity 0.3s',
                  }}
              />

              {/* Avatar quand cam off */}
              {(!stream || !videoEnabled) && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 12,
                  }}>
                    <Avatar name={userName} size={80} showRing />
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  {userName}
                </span>
                  </div>
              )}

              {/* Badge salle verrouillée */}
              {roomLocked && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    background: 'rgba(245,158,11,0.2)',
                    border: '1px solid rgba(245,158,11,0.4)',
                    borderRadius: 8, padding: '4px 10px',
                    fontSize: 11, color: '#fbbf24', fontWeight: 600,
                  }}>
                    🔒 Salle verrouillée
                  </div>
              )}

              {/* Pastilles statut haut-droite */}
              <div style={{
                position: 'absolute', top: 12, right: 12,
                display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
              }}>
                {!audioEnabled && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(239,68,68,0.85)',
                      borderRadius: 6, padding: '3px 8px',
                      fontSize: 11, color: '#fff', fontWeight: 600,
                    }}>
                      <MicOffIcon /> Micro coupé
                    </div>
                )}
                {!videoEnabled && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(239,68,68,0.85)',
                      borderRadius: 6, padding: '3px 8px',
                      fontSize: 11, color: '#fff', fontWeight: 600,
                    }}>
                      <CamOffIcon /> Cam arrêtée
                    </div>
                )}
              </div>

              {/* Nom en bas-gauche */}
              <div style={{
                position: 'absolute', bottom: 12, left: 12,
                background: 'rgba(0,0,0,0.6)',
                borderRadius: 8, padding: '4px 10px',
                fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600,
              }}>
                {userName} {isFirstUser && '👑'}
              </div>
            </div>

            {/* Erreur média */}
            {mediaError && (
                <div style={{
                  margin: '12px 14px 0',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 12, color: '#f87171', whiteSpace: 'pre-line', lineHeight: 1.5,
                }}>
                  ⚠ {mediaError}
                </div>
            )}

            {/* Contrôles micro / cam */}
            <div style={{ display: 'flex', gap: 10, padding: '14px' }}>
              <MediaToggleBtn
                  on={audioEnabled}
                  onToggle={toggleAudio}
                  IconOn={MicOnIcon}
                  IconOff={MicOffIcon}
                  label="Micro"
              />
              <MediaToggleBtn
                  on={videoEnabled}
                  onToggle={toggleVideo}
                  IconOn={CamOnIcon}
                  IconOff={CamOffIcon}
                  label="Caméra"
              />
            </div>

            {/* Pré-test audio / vidéo */}
            <div style={{
              margin: '0 14px 14px',
              padding: '14px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 4,
                  }}>
                    Pré-test avant entrée
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                    Vérifiez vos périphériques avant de rejoindre la réunion
                  </div>
                </div>
                <div style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(96,165,250,0.2)',
                  fontSize: 11,
                  color: '#93c5fd',
                  fontWeight: 700,
                }}>
                  Niveau micro {audioLevel}%
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.32)',
                    marginBottom: 6,
                  }}>
                    Microphone
                  </label>
                  <select
                    value={selectedAudioInputId}
                    onChange={(event) => setSelectedAudioInputId(event.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(8,12,20,0.88)',
                      color: '#e2e8f0',
                      padding: '11px 12px',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  >
                    {availableDevices.audioInputs.length === 0 && <option value="">Aucun microphone détecté</option>}
                    {availableDevices.audioInputs.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.32)',
                    marginBottom: 6,
                  }}>
                    Caméra
                  </label>
                  <select
                    value={selectedVideoInputId}
                    onChange={(event) => setSelectedVideoInputId(event.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(8,12,20,0.88)',
                      color: '#e2e8f0',
                      padding: '11px 12px',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  >
                    {availableDevices.videoInputs.length === 0 && <option value="">Aucune caméra détectée</option>}
                    {availableDevices.videoInputs.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Caméra ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                    Test de niveau micro
                  </span>
                  <span style={{ fontSize: 11, color: audioEnabled ? '#4ade80' : 'rgba(255,255,255,0.28)', fontWeight: 700 }}>
                    {audioEnabled ? 'Entrée détectée' : 'Micro coupé'}
                  </span>
                </div>
                <div style={{
                  height: 10,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: `${audioEnabled ? audioLevel : 0}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: audioLevel > 72
                      ? 'linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)'
                      : 'linear-gradient(90deg, #22c55e 0%, #60a5fa 100%)',
                    transition: 'width 0.08s linear',
                  }} />
                </div>
                <div style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    color: speakingNow ? '#4ade80' : 'rgba(255,255,255,0.35)',
                    fontWeight: 700,
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: speakingNow ? '#22c55e' : 'rgba(255,255,255,0.18)',
                      boxShadow: speakingNow ? '0 0 10px rgba(34,197,94,0.65)' : 'none',
                    }} />
                    {speakingNow ? 'Vous parlez actuellement' : 'Parlez quelques secondes pour vérifier le micro'}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
                    Seuil conseillé: voix claire sans saturation
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                <button
                  onClick={handleApplyDevices}
                  disabled={applyingDevices}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: applyingDevices ? 'wait' : 'pointer',
                    opacity: applyingDevices ? 0.75 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {applyingDevices ? 'Application...' : 'Appliquer et retester'}
                </button>
                <button
                  onClick={handleRefreshDevices}
                  disabled={refreshingDevices}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: refreshingDevices ? 'wait' : 'pointer',
                    opacity: refreshingDevices ? 0.75 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {refreshingDevices ? 'Actualisation...' : 'Actualiser la liste'}
                </button>
                <button
                  onClick={handleSpeakerTest}
                  disabled={playingSpeakerTest}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(96,165,250,0.18)',
                    background: playingSpeakerTest ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.1)',
                    color: '#dbeafe',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: playingSpeakerTest ? 'wait' : 'pointer',
                    opacity: playingSpeakerTest ? 0.82 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {playingSpeakerTest ? 'Lecture du test...' : 'Tester les haut-parleurs'}
                </button>
              </div>

              {deviceStatus && (
                <div style={{
                  marginTop: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(96,165,250,0.18)',
                  background: 'rgba(37,99,235,0.1)',
                  color: '#dbeafe',
                  padding: '9px 12px',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  {deviceStatus}
                </div>
              )}
            </div>

            {/* Indication qualité */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '0 14px 14px',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: stream ? '#4ade80' : '#f87171',
                boxShadow: stream ? '0 0 6px rgba(74,222,128,0.6)' : 'none',
                animation: stream ? 'breathe 2s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
              {stream
                  ? `Caméra ${videoEnabled ? 'active' : 'en pause'} · Micro ${audioEnabled ? 'actif' : 'coupé'}`
                  : 'Caméra non disponible'}
            </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
            COLONNE DROITE — Infos + participants + bouton
        ══════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Carte info réunion */}
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '16px',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Réunion en cours
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4,
                fontFamily: "'DM Mono', monospace", letterSpacing: '-0.02em' }}>
                {roomId?.slice(0, 8).toUpperCase()}…
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Vous rejoignez en tant que{' '}
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>{userName}</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}>
                <div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>
                    Diagnostic avant entrée
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                    Résumé instantané de votre préparation
                  </div>
                </div>
                <div style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: readinessTone.bg,
                  border: `1px solid ${readinessTone.border}`,
                  color: readinessTone.color,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {readinessTone.label}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: item.ok ? '#22c55e' : '#f59e0b',
                        boxShadow: item.ok ? '0 0 10px rgba(34,197,94,0.55)' : '0 0 10px rgba(245,158,11,0.45)',
                      }} />
                      <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.46)', textAlign: 'right' }}>
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginTop: 12,
              }}>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Micro actif
                  </div>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedAudioLabel}
                  </div>
                </div>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Caméra active
                  </div>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedVideoLabel}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  Qualité réseau estimée: {networkQuality === 'good' ? 'Excellente' : networkQuality === 'fair' ? 'Correcte' : networkQuality === 'poor' ? 'Faible' : 'Non exposée'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
                  {networkStats.effectiveType ? `${networkStats.effectiveType.toUpperCase()} · ` : ''}
                  {networkStats.downlink !== null ? `${networkStats.downlink} Mb/s` : 'débit n/d'}
                  {networkStats.rtt !== null ? ` · ${networkStats.rtt} ms` : ''}
                </span>
              </div>
            </div>

            {/* Liste participants */}
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '14px 14px 4px',
              flex: 1,
            }}>
              {/* En-tête */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: 10,
              }}>
                <UsersIcon />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Dans la salle
              </span>
                <div style={{
                  marginLeft: 'auto',
                  background: participants.length > 0
                      ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${participants.length > 0
                      ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 20, padding: '1px 8px',
                  fontSize: 11, fontWeight: 700,
                  color: participants.length > 0 ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                }}>
                  {loadingPeers ? '…' : participants.length}
                </div>
              </div>

              {/* Contenu liste */}
              {loadingPeers ? (
                  <div style={{
                    textAlign: 'center', padding: '20px 0',
                    color: 'rgba(255,255,255,0.2)', fontSize: 12,
                  }}>
                    <div style={{ marginBottom: 6, fontSize: 20 }}>⏳</div>
                    Chargement…
                  </div>
              ) : participants.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '24px 0',
                    color: 'rgba(255,255,255,0.2)', fontSize: 13, lineHeight: 1.6,
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏁</div>
                    Vous serez le premier.<br/>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
                  Démarrez pour inviter vos collègues.
                </span>
                  </div>
              ) : (
                  <div>
                    {participants.map((p, i) => (
                        <ParticipantRow
                            key={p.socketId}
                            p={p}
                            isHost={p.socketId === hostId}
                            isLast={i === participants.length - 1}
                        />
                    ))}
                  </div>
              )}

              <div style={{ height: 10 }} />
            </div>

            {/* Message de rejet */}
            {rejected && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 12, padding: '10px 14px',
                  fontSize: 12, color: '#f87171', lineHeight: 1.5,
                }}>
                  ⛔ {rejected}
                </div>
            )}

            {/* Bouton principal */}
            <button
                onClick={handleJoin}
            disabled={joining}
                style={{
                  width: '100%', padding: '15px',
                  borderRadius: 14, border: 'none',
                  cursor: joining ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.02em',
                  background: joining
                      ? 'rgba(255,255,255,0.06)'
                      : isFirstUser
                          ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: joining ? 'rgba(255,255,255,0.3)' : '#fff',
                  boxShadow: joining ? 'none'
                      : isFirstUser
                          ? '0 6px 24px rgba(245,158,11,0.35)'
                          : '0 6px 24px rgba(59,130,246,0.35)',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (!joining)
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'translateY(1px)';
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = 'none';
                }}
            >
              {btnLabel}
            </button>

            {/* Note contextuelle */}
            <p style={{
              textAlign: 'center', fontSize: 11, margin: 0,
              color: 'rgba(255,255,255,0.18)', lineHeight: 1.6,
            }}>
              {isFirstUser
                  ? 'Vous démarrez en tant qu\'hôte. Partagez le lien pour inviter.'
                  : 'Votre micro et caméra restent dans l\'état choisi ici.'}
            </p>
          </div>
        </div>

        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap');
        @keyframes breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        * { box-sizing: border-box; }
        @media (max-width: 620px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      </div>
  );
}
