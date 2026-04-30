import { EVENTS } from './events.js';

function getRuntimeRtcConfig() {
  if (typeof window === 'undefined') return {};
  return window.electronAPI?.config || {};
}

function getIceServers() {
  const runtimeConfig = getRuntimeRtcConfig();
  const turnUrl = runtimeConfig.turnUrl || import.meta.env.VITE_TURN_URL;
  const turnUsername = runtimeConfig.turnUsername || import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = runtimeConfig.turnCredential || import.meta.env.VITE_TURN_CREDENTIAL;

  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      },
    ].filter((server) => server.urls),
  };
}

/**
 * Creates a configured RTCPeerConnection.
 *
 * BUG FIX: The original onTrack callback was called as:
 *   onTrack(event.streams[0], targetId)   ← WRONG order
 *
 * But addRemoteStream in MediaContext expects:
 *   addRemoteStream(socketId, stream)     ← socketId FIRST
 *
 * So the Map was keyed by [object MediaStream] instead of the socketId,
 * which is why remote video tiles never received their stream.
 */
export function createPeerConnection({ targetId, socket, roomId, stream, onTrack }) {
  const pc = new RTCPeerConnection(getIceServers());
  const remoteStream = new MediaStream();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit(EVENTS.ICE_CANDIDATE, {
        candidate: event.candidate,
        targetUserId: targetId,
        roomId,
      });
    }
  };

  pc.ontrack = (event) => {
    const sourceStream = event.streams[0];

    if (sourceStream) {
      sourceStream.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else if (event.track && !remoteStream.getTracks().some((track) => track.id === event.track.id)) {
      remoteStream.addTrack(event.track);
    }

    if (onTrack && remoteStream.getTracks().length > 0) {
      onTrack(targetId, remoteStream);
    }
  };

  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }

  return pc;
}
