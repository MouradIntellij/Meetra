import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext.jsx';
import { useRoom }   from './RoomContext.jsx';
import { EVENTS }    from '../utils/events.js';
import { createPeerConnection } from '../utils/peer.js';
import { createAudioAnalyser }  from '../utils/audioLevel.js';
import { platform } from '../services/platform/index.js';

const MediaContext = createContext(null);
const AUDIO_DEVICE_STORAGE_KEY = 'meetra-preferred-audio-input';
const VIDEO_DEVICE_STORAGE_KEY = 'meetra-preferred-video-input';
const AUDIO_ENABLED_STORAGE_KEY = 'meetra-preferred-audio-enabled';
const VIDEO_ENABLED_STORAGE_KEY = 'meetra-preferred-video-enabled';

function readStorageValue(key, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function readStorageBool(key, fallback = true) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value !== 'false';
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

function buildMediaConstraints({ audioDeviceId = '', videoDeviceId = '' }) {
  return {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
      ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
    },
  };
}

export const useMedia = () => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be inside MediaProvider');
  return ctx;
};

export function MediaProvider({ children, initialStream = null }) {
  const { socket } = useSocket();
  const { roomId, participants, removeParticipant, setScreenSharingId } = useRoom();

  const [localStream, setLocalStream] = useState(initialStream);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [audioEnabled, setAudioEnabled] = useState(() => readStorageBool(AUDIO_ENABLED_STORAGE_KEY, true));
  const [videoEnabled, setVideoEnabled] = useState(() => readStorageBool(VIDEO_ENABLED_STORAGE_KEY, true));
  const [screenStream, setScreenStream] = useState(null);
  const [screenShareMeta, setScreenShareMeta] = useState(null);
  const [screenShareError, setScreenShareError] = useState('');
  const [mediaAccessError, setMediaAccessError] = useState('');
  const [virtualBackgroundStream, setVirtualBackgroundStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [availableDevices, setAvailableDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(() => readStorageValue(AUDIO_DEVICE_STORAGE_KEY, ''));
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(() => readStorageValue(VIDEO_DEVICE_STORAGE_KEY, ''));

  const peerConnections = useRef(new Map());
  const pendingIceCandidates = useRef(new Map());
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cleanupAudio = useRef(null);
  const localStreamRef = useRef(initialStream);
  const isSharingRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!initialStream) return;

    localStreamRef.current = initialStream;
    setLocalStream(initialStream);

    const audioTrack = initialStream.getAudioTracks()[0] || null;
    const videoTrack = initialStream.getVideoTracks()[0] || null;

    setAudioEnabled(Boolean(audioTrack?.enabled ?? true));
    setVideoEnabled(Boolean(videoTrack?.enabled ?? true));
    setMediaAccessError('');
  }, [initialStream]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, String(audioEnabled));
  }, [audioEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIDEO_ENABLED_STORAGE_KEY, String(videoEnabled));
  }, [videoEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedAudioInputId) {
      window.localStorage.setItem(AUDIO_DEVICE_STORAGE_KEY, selectedAudioInputId);
      return;
    }
    window.localStorage.removeItem(AUDIO_DEVICE_STORAGE_KEY);
  }, [selectedAudioInputId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedVideoInputId) {
      window.localStorage.setItem(VIDEO_DEVICE_STORAGE_KEY, selectedVideoInputId);
      return;
    }
    window.localStorage.removeItem(VIDEO_DEVICE_STORAGE_KEY);
  }, [selectedVideoInputId]);

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  const replaceVideoTrackForAllPeers = useCallback((track) => {
    if (!track) return;

    peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track);
    });
  }, []);

  const stopStream = (stream) => {
    stream?.getTracks().forEach(t => t.stop());
  };

  const refreshAvailableDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((item) => item.kind === 'audioinput');
      const videoInputs = devices.filter((item) => item.kind === 'videoinput');
      const audioOutputs = devices.filter((item) => item.kind === 'audiooutput');

      setAvailableDevices({ audioInputs, videoInputs, audioOutputs });

      if (!selectedAudioInputId && audioInputs[0]?.deviceId) {
        setSelectedAudioInputId(audioInputs[0].deviceId);
      }
      if (!selectedVideoInputId && videoInputs[0]?.deviceId) {
        setSelectedVideoInputId(videoInputs[0].deviceId);
      }
    } catch {}
  }, [selectedAudioInputId, selectedVideoInputId]);

  const looksLikeCurrentConferenceSurface = (track, settings = {}) => {
    const displaySurface = settings.displaySurface || '';
    if (displaySurface !== 'browser') return false;

    const label = (track?.label || '').toLowerCase();
    const title = (document?.title || '').toLowerCase();
    const host = (window?.location?.host || '').toLowerCase();

    return Boolean(
      label &&
      (
        (title && (label.includes(title) || title.includes(label))) ||
        (host && label.includes(host)) ||
        label.includes('videoconf') ||
        label.includes('video conf') ||
        label.includes('localhost') ||
        label.includes('127.0.0.1')
      )
    );
  };

  // ─────────────────────────────────────────────
  // AUDIO ANALYSER
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!initialStream || !socket || !roomId) return;

    cleanupAudio.current?.();

    cleanupAudio.current = createAudioAnalyser(initialStream, (level) => {
      socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
    });
  }, []);

  useEffect(() => {
    refreshAvailableDevices();

    if (!navigator.mediaDevices?.addEventListener) return undefined;
    navigator.mediaDevices.addEventListener('devicechange', refreshAvailableDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshAvailableDevices);
  }, [refreshAvailableDevices]);

  // ─────────────────────────────────────────────
  // REMOTE STREAM
  // ─────────────────────────────────────────────
  const addRemoteStream = useCallback((socketId, stream) => {
    setRemoteStreams(prev => new Map(prev).set(socketId, stream));
  }, []);

  const removeRemoteStream = useCallback((socketId) => {
    setRemoteStreams(prev => {
      const n = new Map(prev);
      n.delete(socketId);
      return n;
    });
  }, []);

  const queueIceCandidate = useCallback((socketId, candidate) => {
    if (!candidate) return;

    const queued = pendingIceCandidates.current.get(socketId) || [];
    queued.push(candidate);
    pendingIceCandidates.current.set(socketId, queued);
  }, []);

  const flushIceCandidates = useCallback(async (socketId, pc) => {
    const queued = pendingIceCandidates.current.get(socketId);
    if (!queued?.length || !pc?.remoteDescription) return;

    pendingIceCandidates.current.delete(socketId);

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }, []);

  // ─────────────────────────────────────────────
  // PEER CONNECTION
  // ─────────────────────────────────────────────
  const buildPC = useCallback((targetId) => {
    if (peerConnections.current.has(targetId)) {
      return peerConnections.current.get(targetId);
    }

    const pc = createPeerConnection({
      targetId,
      socket,
      roomId,
      stream: localStreamRef.current,
      onTrack: addRemoteStream
    });

    peerConnections.current.set(targetId, pc);
    return pc;
  }, [socket, roomId, addRemoteStream]);

  const createAndSendOffer = useCallback(async (targetId) => {
    if (!socket || !targetId || targetId === socket.id) return;

    const pc = buildPC(targetId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit(EVENTS.OFFER, {
      offer: pc.localDescription,
      targetUserId: targetId,
      roomId
    });
  }, [socket, buildPC, roomId]);

  useEffect(() => {
    if (!socket?.id || !participants.length) return;

    participants.forEach((participant) => {
      const targetId = participant?.socketId;
      if (!targetId || targetId === socket.id) return;
      if (peerConnections.current.has(targetId)) return;

      // Deterministic initiator selection avoids double offers:
      // the lexicographically smaller socket id starts the negotiation.
      if (socket.id < targetId) {
        createAndSendOffer(targetId).catch(() => {});
      }
    });
  }, [socket, participants, createAndSendOffer]);

  // ─────────────────────────────────────────────
  // GET MEDIA
  // ─────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(
          buildMediaConstraints({
            audioDeviceId: selectedAudioInputId,
            videoDeviceId: selectedVideoInputId,
          })
        );
      } catch (error) {
        if (!isRecoverableDeviceError(error) || (!selectedAudioInputId && !selectedVideoInputId)) {
          throw error;
        }

        setSelectedAudioInputId('');
        setSelectedVideoInputId('');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AUDIO_DEVICE_STORAGE_KEY);
          window.localStorage.removeItem(VIDEO_DEVICE_STORAGE_KEY);
        }

        stream = await navigator.mediaDevices.getUserMedia(
          buildMediaConstraints({ audioDeviceId: '', videoDeviceId: '' })
        );
      }

      localStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = audioEnabled;
      }
      if (videoTrack) {
        videoTrack.enabled = videoEnabled;
      }
      setLocalStream(stream);
      setAudioEnabled(Boolean(audioTrack?.enabled ?? audioEnabled));
      setVideoEnabled(Boolean(videoTrack?.enabled ?? videoEnabled));
      setMediaAccessError('');

      cleanupAudio.current?.();

      cleanupAudio.current = createAudioAnalyser(stream, (level) => {
        if (socket && roomId) {
          socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
        }
      });

      refreshAvailableDevices();

      return stream;
    } catch {
      refreshAvailableDevices().catch(() => {});
      setMediaAccessError("Caméra ou micro indisponibles. Vous pouvez quand même rejoindre la réunion.");
      setAudioEnabled(false);
      setVideoEnabled(false);
      return null;
    }
  }, [audioEnabled, videoEnabled, socket, roomId, selectedAudioInputId, selectedVideoInputId, refreshAvailableDevices]);

  const replaceMediaDevices = useCallback(async ({ audioDeviceId, videoDeviceId }) => {
    const wantsAudio = audioDeviceId !== undefined ? Boolean(audioDeviceId) : true;
    const wantsVideo = videoDeviceId !== undefined ? Boolean(videoDeviceId) : true;

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: wantsAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
        } : false,
        video: wantsVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
        } : false,
      });

      const previousStream = localStreamRef.current;
      const nextAudioTrack = nextStream.getAudioTracks()[0] || null;
      const nextVideoTrack = nextStream.getVideoTracks()[0] || null;

      if (nextAudioTrack) {
        nextAudioTrack.enabled = audioEnabled;
      }
      if (nextVideoTrack) {
        nextVideoTrack.enabled = videoEnabled;
      }

      localStreamRef.current = nextStream;
      setLocalStream(nextStream);
      setAudioEnabled(Boolean(nextAudioTrack?.enabled ?? false));
      setVideoEnabled(Boolean(nextVideoTrack?.enabled ?? false));
      setMediaAccessError('');

      if (audioDeviceId !== undefined) {
        setSelectedAudioInputId(audioDeviceId || '');
      }
      if (videoDeviceId !== undefined) {
        setSelectedVideoInputId(videoDeviceId || '');
      }

      peerConnections.current.forEach((pc) => {
        const audioSender = pc.getSenders().find((sender) => sender.track?.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(nextAudioTrack);
        }

        if (!screenStream) {
          const videoSender = pc.getSenders().find((sender) => sender.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(nextVideoTrack);
          }
        }
      });

      cleanupAudio.current?.();
      cleanupAudio.current = createAudioAnalyser(nextStream, (level) => {
        if (socket && roomId) {
          socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
        }
      });

      stopStream(previousStream);
      refreshAvailableDevices();
      return true;
    } catch {
      setMediaAccessError("Impossible de basculer vers les périphériques sélectionnés.");
      return false;
    }
  }, [audioEnabled, videoEnabled, refreshAvailableDevices, roomId, screenStream, socket]);

  // ─────────────────────────────────────────────
  // AUDIO / VIDEO TOGGLES
  // ─────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);

    socket?.emit(EVENTS.TOGGLE_AUDIO, {
      roomId,
      userId: socket.id,
      enabled: track.enabled
    });
  }, [socket, roomId]);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);

    socket?.emit(EVENTS.TOGGLE_VIDEO, {
      roomId,
      userId: socket.id,
      enabled: track.enabled
    });
  }, [socket, roomId]);

  // ─────────────────────────────────────────────
  // SCREEN SHARE
  // ─────────────────────────────────────────────
  const startScreenShare = useCallback(async (providedStream = null, options = {}) => {
    if (isSharingRef.current) return; // 🚨 anti double call

    isSharingRef.current = true;
    setScreenShareError('');

    try {
      const wantsBroadPicker = !providedStream && !options.displaySurface;
      const screen = providedStream || await navigator.mediaDevices.getDisplayMedia({
        video: wantsBroadPicker ? {
          frameRate: options.optimize === 'motion' ? { ideal: 30, max: 60 } : { ideal: 15, max: 30 }
        } : {
          displaySurface: options.displaySurface,
          frameRate: options.optimize === 'motion' ? { ideal: 30, max: 60 } : { ideal: 15, max: 30 }
        },
        audio: Boolean(options.sound),
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: options.sound ? 'include' : 'exclude',
      });

      const track = screen.getVideoTracks()[0];
      const settings = track?.getSettings?.() ?? {};

      if (looksLikeCurrentConferenceSurface(track, settings)) {
        stopStream(screen);
        isSharingRef.current = false;
        setScreenShareError("Vous avez choisi l'onglet de la visioconférence. Choisissez plutôt une fenêtre d'application ou un écran entier.");
        return;
      }

      setScreenStream(screen);
      const nextMeta = {
        label: track?.label || 'Votre écran',
        displaySurface: settings.displaySurface || options.displaySurface || 'monitor',
        options,
        startedAt: Date.now(),
      };
      setScreenShareMeta(nextMeta);
      setScreenSharingId(socket.id);

      socket?.emit(EVENTS.SCREEN_START, { roomId });

      replaceVideoTrackForAllPeers(track);
      platform.showPresenterToolbar?.({
        label: nextMeta.label,
        displaySurface: nextMeta.displaySurface,
      });
      if (platform.isElectron && nextMeta.displaySurface === 'window') {
        platform.minimizeMainWindow?.();
      }

      track.onended = () => {
        isSharingRef.current = false;
        stopScreenShare();
      };

    } catch (e) {
      isSharingRef.current = false;
      if (e?.name === 'NotAllowedError') {
        setScreenShareError("Le partage d'écran a été refusé. Autorisez l'accès puis réessayez.");
      } else if (e?.name === 'NotFoundError') {
        setScreenShareError("Aucune source de partage n'a été trouvée sur cet appareil.");
      } else {
        setScreenShareError("Impossible de démarrer le partage d'écran pour le moment.");
      }
    }
  }, [socket, roomId, replaceVideoTrackForAllPeers, setScreenSharingId]);

  const stopScreenShare = useCallback(() => {
    if (!screenStream) return;

    isSharingRef.current = false;

    screenStream.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setScreenShareMeta(null);

    setScreenSharingId(null);
    platform.hidePresenterToolbar?.();
    if (platform.isElectron) {
      platform.restoreMainWindow?.();
    }

    socket?.emit(EVENTS.SCREEN_STOP, { roomId });

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    replaceVideoTrackForAllPeers(cameraTrack);

  }, [screenStream, socket, roomId, replaceVideoTrackForAllPeers, setScreenSharingId]);
  // ─────────────────────────────────────────────
  // RECORDING
  // ─────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);

    socket?.emit(EVENTS.RECORDING_START, { roomId });
  }, [socket, roomId]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;

    recorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${Date.now()}.webm`;
      a.click();

      URL.revokeObjectURL(url);
    };

    recorderRef.current.stop();
    recorderRef.current = null;

    setIsRecording(false);

    socket?.emit(EVENTS.RECORDING_STOP, { roomId });
  }, [socket, roomId]);

  // ─────────────────────────────────────────────
  // LEAVE ROOM
  // ─────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    stopStream(localStreamRef.current);
    stopStream(screenStream);

    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    pendingIceCandidates.current.clear();

    cleanupAudio.current?.();

    setLocalStream(null);
    setScreenStream(null);
    setScreenShareMeta(null);
    setVirtualBackgroundStream(null);
    setRemoteStreams(new Map());
    platform.hidePresenterToolbar?.();
    if (platform.isElectron) {
      platform.restoreMainWindow?.();
    }
  }, [screenStream]);

  useEffect(() => {
    if (!screenStream || !screenShareMeta) return;
    platform.updatePresenterToolbar?.({
      label: screenShareMeta.label,
      displaySurface: screenShareMeta.displaySurface,
    });
  }, [screenStream, screenShareMeta]);

  // ─────────────────────────────────────────────
  // WEBRTC EVENTS
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onUserJoined = async ({ socketId }) => {
      if (socketId === socket.id) return;
      await createAndSendOffer(socketId);
    };

    const onOffer = async ({ offer, fromUserId, socketId }) => {
      const peerId = fromUserId || socketId;
      if (!peerId) return;
      const pc = buildPC(peerId);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIceCandidates(peerId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit(EVENTS.ANSWER, {
        answer: pc.localDescription,
        targetUserId: peerId,
        roomId
      });
    };

    const onAnswer = async ({ answer, fromUserId, socketId }) => {
      const peerId = fromUserId || socketId;
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceCandidates(peerId, pc);
      }
    };

    const onIce = async ({ candidate, fromUserId, socketId }) => {
      const peerId = fromUserId || socketId;
      if (!peerId) return;
      const pc = peerConnections.current.get(peerId);
      if (pc?.remoteDescription && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
        return;
      }

      queueIceCandidate(peerId, candidate);
    };

    const onUserLeft = ({ socketId }) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }

      removeRemoteStream(socketId);
      removeParticipant(socketId);
      pendingIceCandidates.current.delete(socketId);
    };

    socket.on(EVENTS.USER_JOINED, onUserJoined);
    socket.on(EVENTS.OFFER, onOffer);
    socket.on(EVENTS.ANSWER, onAnswer);
    socket.on(EVENTS.ICE_CANDIDATE, onIce);
    socket.on(EVENTS.USER_LEFT, onUserLeft);

    return () => {
      socket.off(EVENTS.USER_JOINED, onUserJoined);
      socket.off(EVENTS.OFFER, onOffer);
      socket.off(EVENTS.ANSWER, onAnswer);
      socket.off(EVENTS.ICE_CANDIDATE, onIce);
      socket.off(EVENTS.USER_LEFT, onUserLeft);
    };
  }, [socket, createAndSendOffer, buildPC, flushIceCandidates, queueIceCandidate, removeRemoteStream, removeParticipant]);

  return (
      <MediaContext.Provider value={{
        localStream,
        displayLocalStream: virtualBackgroundStream || localStream,
        remoteStreams,
        audioEnabled,
        videoEnabled,
        screenStream,
        screenShareMeta,
        screenShareError,
        mediaAccessError,
        clearScreenShareError: () => setScreenShareError(''),
        setVirtualBackgroundStream,
        isSharing: Boolean(screenStream),
        isRecording,
        availableDevices,
        selectedAudioInputId,
        selectedVideoInputId,
        peerConnections,
        getMedia,
        refreshAvailableDevices,
        replaceMediaDevices,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        startRecording,
        stopRecording,
        leaveRoom,
      }}>
        {children}
      </MediaContext.Provider>
  );
}
