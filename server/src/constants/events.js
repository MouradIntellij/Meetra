// server/src/constants/events.js
// ⚠️  Synchronisé avec client/src/utils/events.js

// ─── Exports individuels ──────────────────────────────────────────────────────
export const JOIN_ROOM            = 'join-room';
export const LEAVE_ROOM           = 'leave-room';
export const ROOM_JOINED          = 'room-joined';
export const ROOM_PARTICIPANTS    = 'room-participants';
export const USER_JOINED          = 'user-joined';
export const USER_LEFT            = 'user-left';

export const OFFER                = 'offer';
export const ANSWER               = 'answer';
export const ICE_CANDIDATE        = 'ice-candidate';

export const CHAT_MESSAGE         = 'chat-message';
export const REACTION             = 'reaction';
export const REACTION_BROADCAST   = 'reaction-broadcast';
export const RAISE_HAND           = 'raise-hand';
export const LOWER_HAND           = 'lower-hand';
export const HAND_RAISED          = 'hand-raised';
export const HAND_LOWERED         = 'hand-lowered';

export const MUTE_ALL             = 'mute-all';
export const KICK_USER            = 'kick-user';
export const LOCK_ROOM            = 'lock-room';
export const ASSIGN_HOST          = 'assign-host';

export const SCREEN_SHARE_START   = 'screen-share-start';
export const SCREEN_SHARE_STOP    = 'screen-share-stop';
export const RECORDING_START      = 'recording-start';
export const RECORDING_STOP       = 'recording-stop';

export const BREAKOUT_CREATE      = 'breakout-create';
export const BREAKOUT_JOIN        = 'breakout-join';
export const BREAKOUT_END         = 'breakout-end';

// ─── Salle d'attente ──────────────────────────────────────────────────────────
export const ADMIT_GUEST          = 'admit-guest';
export const DENY_GUEST           = 'deny-guest';
export const WAITING_ROOM_GUEST   = 'waiting-room-guest';
export const GUEST_ADMITTED       = 'guest-admitted';
export const GUEST_DENIED         = 'guest-denied';
export const WAITING_ROOM_STATUS  = 'waiting-room-status';
export const WAITING_ROOM_UPDATE  = 'waiting-room-update';

// ─── Export groupé EVENTS ─────────────────────────────────────────────────────
// Requis par : mediaHandler.js, roomHandler.js, chatHandler.js, etc.
// import { EVENTS } from '../../constants/events.js'
// Utilisation : EVENTS.USER_JOINED, EVENTS.OFFER, EVENTS.SCREEN_START, etc.
export const EVENTS = {
    // Salle
    JOIN_ROOM,
    LEAVE_ROOM,
    ROOM_JOINED,
    ROOM_PARTICIPANTS,
    USER_JOINED,
    USER_LEFT,

    // WebRTC
    OFFER,
    ANSWER,
    ICE:              'ice',
    ICE_CANDIDATE,

    // Chat & interactions
    CHAT_MESSAGE,
    REACTION,
    REACTION_BROADCAST,
    RAISE_HAND,
    LOWER_HAND,
    HAND_RAISED,
    HAND_LOWERED,

    // Contrôles hôte
    MUTE_ALL,
    KICK_USER,
    LOCK_ROOM,
    ASSIGN_HOST,

    // Partage d'écran (noms courts utilisés dans mediaHandler)
    SCREEN_START:     'screen-share-start',
    SCREEN_STOP:      'screen-share-stop',
    SCREEN_SHARE_START,
    SCREEN_SHARE_STOP,

    // Enregistrement
    RECORDING_START,
    RECORDING_STOP,

    // Niveau audio (utilisé dans mediaHandler : EVENTS.AUDIO_LEVEL)
    AUDIO_LEVEL:      'audio-level',

    // Breakout
    BREAKOUT_CREATE,
    BREAKOUT_JOIN,
    BREAKOUT_END,

    // Salle d'attente
    ADMIT_GUEST,
    DENY_GUEST,
    WAITING_ROOM_GUEST,
    GUEST_ADMITTED,
    GUEST_DENIED,
    WAITING_ROOM_STATUS,
    WAITING_ROOM_UPDATE,
};
