import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { connectLiveKitRoom } from '../../services/livekit/livekitClient.js';

function initials(name = '') {
  return String(name || 'M')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'M';
}

function LiveKitTrackElement({ track, muted = false, className = '', style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !track) return undefined;

    track.attach(element);
    element.muted = muted;
    element.play?.().catch(() => {});

    return () => {
      track.detach(element);
    };
  }, [track, muted]);

  if (track?.kind === Track.Kind.Audio) {
    return <audio ref={ref} autoPlay playsInline muted={muted} />;
  }

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: '#020617',
        ...style,
      }}
    />
  );
}

function getParticipantName(participant, fallback = 'Participant') {
  return participant?.name || participant?.identity || fallback;
}

function collectTrackItems(room) {
  if (!room) return [];

  const items = [];

  const addParticipantTracks = (participant, isLocal = false) => {
    const publications = Array.from(participant?.trackPublications?.values?.() || []);
    const videoPublication = publications.find((publication) =>
      publication?.kind === Track.Kind.Video
      && publication?.source !== Track.Source.ScreenShare
    );
    const screenPublication = publications.find((publication) =>
      publication?.kind === Track.Kind.Video
      && publication?.source === Track.Source.ScreenShare
    );
    const audioPublication = publications.find((publication) => publication?.kind === Track.Kind.Audio);

    items.push({
      key: `${isLocal ? 'local' : 'remote'}:${participant.identity}`,
      participant,
      isLocal,
      name: isLocal ? 'Vous' : getParticipantName(participant),
      videoTrack: videoPublication?.track || null,
      screenTrack: screenPublication?.track || null,
      audioTrack: audioPublication?.track || null,
      audioMuted: audioPublication?.isMuted ?? true,
      videoMuted: videoPublication?.isMuted ?? true,
    });
  };

  addParticipantTracks(room.localParticipant, true);
  room.remoteParticipants.forEach((participant) => addParticipantTracks(participant, false));

  return items;
}

function LiveKitTile({ item }) {
  const hasVideo = Boolean(item.videoTrack) && !item.videoMuted;

  return (
    <div style={{
      position: 'relative',
      minHeight: 180,
      borderRadius: 14,
      overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))',
      border: '1px solid rgba(148,163,184,0.14)',
      boxShadow: '0 18px 40px rgba(2,6,23,0.28)',
    }}>
      {hasVideo ? (
        <LiveKitTrackElement track={item.videoTrack} muted={item.isLocal} />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          minHeight: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #2563eb, #059669)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 24,
            boxShadow: '0 16px 40px rgba(37,99,235,0.28)',
          }}>
            {initials(item.name)}
          </div>
        </div>
      )}

      {!item.isLocal && item.audioTrack && (
        <LiveKitTrackElement track={item.audioTrack} />
      )}

      <div style={{
        position: 'absolute',
        left: 10,
        bottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: '6px 10px',
        background: 'rgba(2,6,23,0.78)',
        color: '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        fontSize: 12,
        fontWeight: 700,
      }}>
        <span>{item.name}</span>
        {item.audioMuted && <span style={{ color: '#f87171' }}>micro off</span>}
      </div>
    </div>
  );
}

export default function LiveKitRoomView({ roomId, userName, onFallback, onLeave }) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const roomRef = useRef(null);
  const fallbackCalledRef = useRef(false);

  const bump = useCallback(() => setVersion((current) => current + 1), []);

  const triggerFallback = useCallback((reason) => {
    if (fallbackCalledRef.current) return;
    fallbackCalledRef.current = true;
    onFallback?.(reason);
  }, [onFallback]);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus('connecting');
      setError('');

      try {
        const result = await connectLiveKitRoom({ roomId, userName });
        if (cancelled) {
          await result.room?.disconnect?.();
          return;
        }

        if (result?.skipped) {
          triggerFallback(result.reason || 'LIVEKIT_SKIPPED');
          return;
        }

        const nextRoom = result.room;
        roomRef.current = nextRoom;

        const rerenderEvents = [
          RoomEvent.ParticipantConnected,
          RoomEvent.ParticipantDisconnected,
          RoomEvent.TrackSubscribed,
          RoomEvent.TrackUnsubscribed,
          RoomEvent.LocalTrackPublished,
          RoomEvent.LocalTrackUnpublished,
          RoomEvent.TrackMuted,
          RoomEvent.TrackUnmuted,
          RoomEvent.ConnectionStateChanged,
        ];

        rerenderEvents.forEach((eventName) => nextRoom.on(eventName, bump));

        await nextRoom.localParticipant.setMicrophoneEnabled(true);
        await nextRoom.localParticipant.setCameraEnabled(true);

        setRoom(nextRoom);
        setStatus('connected');
        bump();
      } catch (connectError) {
        const message = connectError?.message || 'LIVEKIT_CONNECTION_FAILED';
        setError(message);
        setStatus('fallback');
        triggerFallback(message);
      }
    }

    connect();

    return () => {
      cancelled = true;
      const activeRoom = roomRef.current;
      roomRef.current = null;
      setRoom(null);
      activeRoom?.disconnect?.();
    };
  }, [bump, roomId, triggerFallback, userName]);

  const trackItems = useMemo(() => collectTrackItems(room), [room, version]);
  const cols = trackItems.length <= 1 ? 1 : trackItems.length <= 4 ? 2 : 3;
  const screenShareItem = trackItems.find((item) => item.screenTrack);

  const toggleAudio = async () => {
    if (!roomRef.current) return;
    const next = !localAudioEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setLocalAudioEnabled(next);
    bump();
  };

  const toggleVideo = async () => {
    if (!roomRef.current) return;
    const next = !localVideoEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(next);
    setLocalVideoEnabled(next);
    bump();
  };

  const startScreenShare = async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(true);
    bump();
  };

  const stopScreenShare = async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(false);
    bump();
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#080c14',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: '7px 11px',
        color: status === 'connected' ? '#bbf7d0' : '#bfdbfe',
        background: status === 'connected' ? 'rgba(20,83,45,0.72)' : 'rgba(30,64,175,0.72)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: status === 'connected' ? '#22c55e' : '#60a5fa',
        }} />
        LiveKit SFU
      </div>

      {status === 'connecting' && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(226,232,240,0.72)',
          fontSize: 14,
        }}>
          Connexion a la SFU LiveKit...
        </div>
      )}

      {status === 'fallback' && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fecaca',
          fontSize: 14,
          padding: 20,
          textAlign: 'center',
        }}>
          Connexion LiveKit impossible. Retour au mode P2P. {error}
        </div>
      )}

      {status === 'connected' && (
        <>
          {screenShareItem?.screenTrack ? (
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: '1fr 116px',
              gap: 10,
              padding: 10,
            }}>
              <div style={{
                borderRadius: 14,
                overflow: 'hidden',
                background: '#020617',
                border: '1px solid rgba(34,197,94,0.25)',
              }}>
                <LiveKitTrackElement track={screenShareItem.screenTrack} muted={screenShareItem.isLocal} style={{ objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                {trackItems.map((item) => (
                  <div key={item.key} style={{ width: 170, flexShrink: 0 }}>
                    <LiveKitTile item={item} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 8,
              padding: 8,
            }}>
              {trackItems.map((item) => (
                <LiveKitTile key={item.key} item={item} />
              ))}
            </div>
          )}

          <div style={{
            height: 68,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'rgba(2,6,23,0.92)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button onClick={toggleAudio} style={liveKitButtonStyle(localAudioEnabled)}>
              {localAudioEnabled ? 'Micro on' : 'Micro off'}
            </button>
            <button onClick={toggleVideo} style={liveKitButtonStyle(localVideoEnabled)}>
              {localVideoEnabled ? 'Camera on' : 'Camera off'}
            </button>
            <button onClick={screenShareItem?.isLocal ? stopScreenShare : startScreenShare} style={liveKitButtonStyle(Boolean(screenShareItem?.isLocal))}>
              {screenShareItem?.isLocal ? 'Stop partage' : 'Partager'}
            </button>
            <button onClick={() => triggerFallback('USER_REQUESTED_P2P')} style={liveKitFallbackButtonStyle}>
              Mode P2P
            </button>
            <button onClick={onLeave} style={liveKitLeaveButtonStyle}>
              Quitter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function liveKitButtonStyle(active) {
  return {
    border: '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(37,99,235,0.86)' : 'rgba(15,23,42,0.92)',
    color: active ? '#fff' : '#cbd5e1',
    borderRadius: 14,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  };
}

const liveKitFallbackButtonStyle = {
  border: '1px solid rgba(248,113,113,0.26)',
  background: 'rgba(127,29,29,0.72)',
  color: '#fee2e2',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const liveKitLeaveButtonStyle = {
  border: '1px solid rgba(248,113,113,0.35)',
  background: '#dc2626',
  color: '#fff',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};
