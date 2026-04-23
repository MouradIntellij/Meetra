import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext.jsx';
import { useRoom }   from './RoomContext.jsx';
import { EVENTS }    from '../utils/events.js';
import { createPeerConnection } from '../utils/peer.js';
import { createAudioAnalyser }  from '../utils/audioLevel.js';

const MediaContext = createContext(null);

export const useMedia = () => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be inside MediaProvider');
  return ctx;
};

export function MediaProvider({ children, initialStream = null }) {
  const { socket } = useSocket();

  // 🔥 AJOUT IMPORTANT
  const { roomId, removeParticipant, setScreenSharingId } = useRoom();

  const [localStream, setLocalStream] = useState(initialStream);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenStream, setScreenStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const peerConnections = useRef(new Map());
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cleanupAudio = useRef(null);
  const localStreamRef = useRef(initialStream);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // ─────────────────────────────────────────────
  // AUDIO ANALYSER
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!initialStream || !socket || !roomId) return;
    if (cleanupAudio.current) cleanupAudio.current();

    cleanupAudio.current = createAudioAnalyser(initialStream, (level) => {
      socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
    });
  }, []);

  // ─────────────────────────────────────────────
  // REMOTE STREAM
  // ─────────────────────────────────────────────
  const addRemoteStream = useCallback((socketId, stream) => {
    console.log(`[WebRTC] Remote stream received from ${socketId}`);
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

    const stream = localStreamRef.current;

    const pc = createPeerConnection({
      targetId,
      socket,
      roomId,
      stream,
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

    if (cleanupAudio.current) cleanupAudio.current();

    cleanupAudio.current = createAudioAnalyser(stream, (level) => {
      if (socket && roomId)
        socket.emit(EVENTS.AUDIO_LEVEL, { roomId, level });
    });

    return stream;
  }, [socket, roomId]);

  // ─────────────────────────────────────────────
  // AUDIO / VIDEO TOGGLES
  // ─────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    const track = stream?.getAudioTracks()[0];
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
    const stream = localStreamRef.current;
    const track = stream?.getVideoTracks()[0];
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
  // 🎯 SCREEN SHARE FIX (IMPORTANT PART)
  // ─────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setScreenStream(screen);

      // 🔥 UI STATE GLOBAL (BORDER GREEN + FOCUS)
      setScreenSharingId(socket.id);

      socket?.emit(EVENTS.SCREEN_START, { roomId });

      const videoTrack = screen.getVideoTracks()[0];

      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      videoTrack.onended = () => stopScreenShare();
    } catch (e) {
      console.warn('Screen share cancelled:', e.message);
    }
  }, [socket, roomId, setScreenSharingId]);

  const stopScreenShare = useCallback(() => {
    if (!screenStream) return;

    screenStream.getTracks().forEach(t => t.stop());
    setScreenStream(null);

    // 🔥 RESET UI STATE
    setScreenSharingId(null);

    socket?.emit(EVENTS.SCREEN_STOP, { roomId });

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

    peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    });
  }, [screenStream, socket, roomId, setScreenSharingId]);

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
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());

    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    if (cleanupAudio.current) cleanupAudio.current();

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
  }, [screenStream]);

  // ─────────────────────────────────────────────
  // WEBRTC EVENTS (UNCHANGED)
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
        remoteStreams,
        audioEnabled,
        videoEnabled,
        screenStream,
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