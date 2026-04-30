import { EVENTS } from './events.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    },
  ].filter((server) => server.urls),
};

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
  const pc = new RTCPeerConnection(ICE_SERVERS);

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
    if (onTrack && event.streams[0]) {
      onTrack(targetId, event.streams[0]);
    }
  };

  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }

  return pc;
}
