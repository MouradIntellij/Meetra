export const EVENTS = {
  // Room lifecycle
  JOIN_ROOM:         "join-room",
  USER_JOINED:       "user-joined",
  USER_LEFT:         "user-left",
  ROOM_PARTICIPANTS: "room-participants",

  // WebRTC signaling
  OFFER:   "offer",
  ANSWER:  "answer",
  ICE:     "ice-candidate",

  // Chat
  CHAT: "chat-message",

  // Screen share
  SCREEN_START: "screen-share-start",
  SCREEN_STOP:  "screen-share-stop",

  // Host controls
  MUTE_ALL:    "mute-all",
  MUTE_USER:   "mute-user",
  KICK_USER:   "kick-user",
  LOCK_ROOM:   "lock-room",
  ASSIGN_HOST: "assign-host",
  HOST_CHANGED:"host-changed",

  // Participant status
  TOGGLE_VIDEO:   "toggle-video",
  TOGGLE_AUDIO:   "toggle-audio",
  VIDEO_TOGGLED:  "user-video-toggled",
  AUDIO_TOGGLED:  "user-audio-toggled",
  MUTED_BY_HOST:  "muted-by-host",
  KICKED:         "kicked",
  ROOM_LOCKED:    "room-locked",

  // Raise hand
  RAISE_HAND:  "raise-hand",
  LOWER_HAND:  "lower-hand",
  HAND_RAISED: "hand-raised",
  HAND_LOWERED:"hand-lowered",

  // Reactions
  REACTION:           "reaction",
  REACTION_BROADCAST: "reaction-broadcast",

  // Audio levels
  AUDIO_LEVEL:   "audio-level",
  ACTIVE_SPEAKER:"active-speaker",

  // Recording
  RECORDING_START: "recording-start",
  RECORDING_STOP:  "recording-stop",

  // Breakout rooms
  BREAKOUT_CREATE:   "breakout-create",
  BREAKOUT_JOIN:     "breakout-join",
  BREAKOUT_LEAVE:    "breakout-leave",
  BREAKOUT_END_ALL:  "breakout-end-all",
  BREAKOUT_UPDATED:  "breakout-updated",
  BREAKOUT_ASSIGNED: "breakout-assigned",

  // Whiteboard
  WHITEBOARD_DRAW:  "whiteboard-draw",
  WHITEBOARD_CLEAR: "whiteboard-clear",

  // ── SALLE D'ATTENTE (nouveaux) ─────────────────────────────
  WAITING_JOIN:     "waiting-join",      // émettre pour entrer en salle d'attente
  WAITING_LEAVE:    "waiting-leave",     // émettre pour quitter la salle d'attente
  WAITING_UPDATE:   "waiting-update",    // écouter : liste des gens en attente
  WAITING_ADMITTED: "waiting-admitted",  // écouter : l'hôte nous a admis → entrer en salle
  WAITING_REJECTED: "waiting-rejected",  // écouter : l'hôte nous a refusé
  WAITING_ADMIT:    "waiting-admit",     // hôte émet : admettre un user
  WAITING_REJECT:   "waiting-reject",    // hôte émet : refuser un user
  WAITING_ADMIT_ALL:"waiting-admit-all", // hôte émet : admettre tout le monde



  // ─── Ajouter ces constantes dans les deux fichiers events.js ─
// client/src/utils/events.js  ET  server/src/constants/events.js

// Transfert de fichiers dans le chat
  FILE_TRANSFER_START:    "file-transfer-start",
  FILE_TRANSFER_READY:    "file-transfer-ready",
  FILE_TRANSFER_CHUNK:    "file-transfer-chunk",
  FILE_TRANSFER_PROGRESS: "file-transfer-progress",
  FILE_TRANSFER_ERROR:    "file-transfer-error",
  FILE_TRANSFER_CANCEL:   "file-transfer-cancel",

// Réactions sur messages
  CHAT_REACTION:          "chat-reaction",

  // Transcription / captions
  TRANSCRIPTION_START:    "transcription-start",
  TRANSCRIPTION_STOP:     "transcription-stop",
  TRANSCRIPTION_SEGMENT:  "transcription-segment",
  TRANSCRIPTION_STATE:    "transcription-state",
  TRANSCRIPTION_ERROR:    "transcription-error",
  TRANSCRIPTION_SUMMARY_READY: "transcription-summary-ready",
  TRANSCRIPTION_AUDIO_CHUNK: "transcription-audio-chunk",
};
