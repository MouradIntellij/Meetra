import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext.jsx';
import { useRoom }   from './RoomContext.jsx';
import { EVENTS }    from '../utils/events.js';
import { createPeerConnection } from '../utils/peer.js';
import { createAudioAnalyser }  from '../utils/audioLevel.js';
import { platform } from '../services/platform/index.js';

const MediaContext = createContext(null);

export const useMedia = () => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be inside MediaProvider');
  return ctx;
};

export function MediaProvider({ children, initialStream = null }) {
  const { socket } = useSocket();
  const { roomId, removeParticipant, setScreenSharingId } = useRoom();

  const [localStream, setLocalStream] = useState(initialStream);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenStream, setScreenStream] = useState(null);
  const [screenShareMeta, setScreenShareMeta] = useState(null);
  const [screenShareError, setScreenShareError] = useState('');
  const [virtualBackgroundStream, setVirtualBackgroundStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const peerConnections = useRef(new Map());
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cleanupAudio = useRef(null);
  const localStreamRef = useRef(initialStream);
  const isSharingRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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

  // ─────────────────────────────────────────────
  // PEER CONNECTION
  // ─────────────────────────────────────────────
  const buildPC = useCallback((targetId) => {
    if (peerConnections.current.has(targetId)) {
      peerConnections.current.get(targetId).close();
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

  // ─────────────────────────────────────────────
  // GET MEDIA
  // ─────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    cleanupAudio.current?.();

    cleanupAudio.current = createAudioAnalyser(stream, (level) => {
      if (socket && roomId) {
        socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
      }
    });

    return stream;
  }, [socket, roomId]);

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

    cleanupAudio.current?.();

    setLocalStream(null);
    setScreenStream(null);
    setScreenShareMeta(null);
    setVirtualBackgroundStream(null);
    setRemoteStreams(new Map());
    platform.hidePresenterToolbar?.();
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

      const pc = buildPC(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit(EVENTS.OFFER, {
        offer: pc.localDescription,
        targetUserId: socketId,
        roomId
      });
    };

    const onOffer = async ({ offer, fromUserId }) => {
      const pc = buildPC(fromUserId);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit(EVENTS.ANSWER, {
        answer: pc.localDescription,
        targetUserId: fromUserId,
        roomId
      });
    };

    const onAnswer = async ({ answer, fromUserId }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const onIce = async ({ candidate, fromUserId }) => {
      const pc = peerConnections.current.get(fromUserId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    };

    const onUserLeft = ({ socketId }) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }

      removeRemoteStream(socketId);
      removeParticipant(socketId);
    };

    socket.on(EVENTS.USER_JOINED, onUserJoined);
    socket.on(EVENTS.OFFER, onOffer);
    socket.on(EVENTS.ANSWER, onAnswer);
    socket.on(EVENTS.ICE, onIce);
    socket.on(EVENTS.USER_LEFT, onUserLeft);

    return () => {
      socket.off(EVENTS.USER_JOINED, onUserJoined);
      socket.off(EVENTS.OFFER, onOffer);
      socket.off(EVENTS.ANSWER, onAnswer);
      socket.off(EVENTS.ICE, onIce);
      socket.off(EVENTS.USER_LEFT, onUserLeft);
    };
  }, [socket, roomId, buildPC, removeRemoteStream, removeParticipant]);

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
        clearScreenShareError: () => setScreenShareError(''),
        setVirtualBackgroundStream,
        isSharing: Boolean(screenStream),
        isRecording,
        peerConnections,
        getMedia,
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
