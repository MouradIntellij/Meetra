export const EVENTS = {
  // Room lifecycle
  JOIN_ROOM:        "join-room",
  USER_JOINED:      "user-joined",
  USER_LEFT:        "user-left",
  ROOM_PARTICIPANTS:"room-participants",
  ROOM_NOT_FOUND:   "room-not-found",

  // WebRTC signaling
  OFFER:            "offer",
  ANSWER:           "answer",
  ICE:              "ice-candidate",

  // Chat
  CHAT:             "chat-message",

  // Screen share
  SCREEN_START:     "screen-share-start",
  SCREEN_STOP:      "screen-share-stop",

  // Host controls
  MUTE_ALL:         "mute-all",
  MUTE_USER:        "mute-user",
  KICK_USER:        "kick-user",
  LOCK_ROOM:        "lock-room",
  ASSIGN_HOST:      "assign-host",
  ASSIGN_COHOST:    "assign-cohost",
  REMOVE_COHOST:    "remove-cohost",
  HOST_CHANGED:     "host-changed",
  COHOSTS_UPDATED:  "cohosts-updated",

  // Participant status
  TOGGLE_VIDEO:     "toggle-video",
  TOGGLE_AUDIO:     "toggle-audio",
  VIDEO_TOGGLED:    "user-video-toggled",
  AUDIO_TOGGLED:    "user-audio-toggled",
  MUTED_BY_HOST:    "muted-by-host",
  KICKED:           "kicked",
  ROOM_LOCKED:      "room-locked",

  // Raise hand
  RAISE_HAND:       "raise-hand",
  LOWER_HAND:       "lower-hand",
  HAND_RAISED:      "hand-raised",
  HAND_LOWERED:     "hand-lowered",

  // Reactions
  REACTION:         "reaction",
  REACTION_BROADCAST: "reaction-broadcast",

  // Audio levels (active speaker)
  AUDIO_LEVEL:      "audio-level",
  ACTIVE_SPEAKER:   "active-speaker",

  // Recording (client-side signaling)
  RECORDING_START:  "recording-start",
  RECORDING_STOP:   "recording-stop",

  // Breakout rooms
  BREAKOUT_CREATE:  "breakout-create",
  BREAKOUT_JOIN:    "breakout-join",
  BREAKOUT_LEAVE:   "breakout-leave",
  BREAKOUT_END_ALL: "breakout-end-all",
  BREAKOUT_UPDATED: "breakout-updated",
  BREAKOUT_ASSIGNED:"breakout-assigned",

  // Whiteboard
  WHITEBOARD_DRAW:  "whiteboard-draw",
  WHITEBOARD_CLEAR: "whiteboard-clear",

  // Analytics
  STATS_UPDATE:     "stats-update",

  // ── SALLE D'ATTENTE (nouveaux) ─────────────────────────────
  WAITING_JOIN:     "waiting-join",      // client → serveur : entre en salle d'attente
  WAITING_LEAVE:    "waiting-leave",     // client → serveur : quitte la salle d'attente
  WAITING_UPDATE:   "waiting-update",    // serveur → clients en attente : liste mise à jour
  WAITING_ADMITTED: "waiting-admitted",  // serveur → un client : l'hôte l'a admis
  WAITING_REJECTED: "waiting-rejected",  // serveur → un client : l'hôte l'a refusé
  WAITING_ADMIT:    "waiting-admit",     // hôte → serveur : admettre un utilisateur
  WAITING_REJECT:   "waiting-reject",    // hôte → serveur : refuser un utilisateur
  WAITING_ADMIT_ALL:"waiting-admit-all", // hôte → serveur : admettre tout le monde


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

  // Hub / direct messaging
  HUB_ACCESS: "hub-access",
  HUB_MESSAGE_SEND: "hub-message-send",
  HUB_MESSAGE_RECEIVED: "hub-message-received",
  HUB_ACTIVITY_RECEIVED: "hub-activity-received",

};
