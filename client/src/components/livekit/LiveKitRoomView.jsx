import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { connectLiveKitRoom } from '../../services/livekit/livekitClient.js';
import { useLiveKitVirtualBackground } from '../../hooks/useLiveKitVirtualBackground.js';
import LiveKitControlBar from './LiveKitControlBar.jsx';

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

function getLocalCameraTrack(room) {
  if (!room?.localParticipant) return null;
  const publications = Array.from(room.localParticipant.trackPublications?.values?.() || []);
  return publications.find((publication) =>
    publication?.kind === Track.Kind.Video
    && publication?.source !== Track.Source.ScreenShare
    && publication?.track
  )?.track || null;
}

function getTrackMediaStreamTrack(track) {
  return track?.mediaStreamTrack || track?.mediaStreamTrack?.() || null;
}

function LiveKitTile({ item, compact = false }) {
  const hasVideo = Boolean(item.videoTrack) && !item.videoMuted;
  const minHeight = compact ? 112 : 180;

  return (
    <div style={{
      position: 'relative',
      minHeight,
      height: compact ? 112 : '100%',
      borderRadius: 14,
      overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))',
      border: item.screenTrack ? '2px solid rgba(250,204,21,0.88)' : '1px solid rgba(148,163,184,0.14)',
      boxShadow: item.screenTrack ? '0 0 0 3px rgba(250,204,21,0.14), 0 18px 40px rgba(2,6,23,0.28)' : '0 18px 40px rgba(2,6,23,0.28)',
    }}>
      {hasVideo ? (
        <LiveKitTrackElement track={item.videoTrack} muted={item.isLocal} />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          minHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: compact ? 46 : 72,
            height: compact ? 46 : 72,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #2563eb, #059669)',
            color: '#fff',
            fontWeight: 800,
            fontSize: compact ? 16 : 24,
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
        {item.screenTrack && <span style={{ color: '#facc15' }}>partage</span>}
        {item.audioMuted && <span style={{ color: '#f87171' }}>micro off</span>}
      </div>
    </div>
  );
}

function ScreenShareStage({ item, expanded, onToggleExpanded }) {
  const stageRef = useRef(null);
  const label = item.isLocal ? 'Vous partagez votre ecran' : `${item.name} partage son ecran`;

  const requestFullscreen = () => {
    const element = stageRef.current;
    if (!element?.requestFullscreen) return;
    element.requestFullscreen().catch(() => {});
  };

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#020617',
        border: '3px solid #facc15',
        boxShadow: '0 0 0 5px rgba(250,204,21,0.16), 0 24px 70px rgba(2,6,23,0.45)',
        minHeight: 0,
      }}
    >
      <LiveKitTrackElement track={item.screenTrack} muted={item.isLocal} style={{ objectFit: 'contain' }} />

      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: '7px 11px',
        background: 'rgba(113,63,18,0.86)',
        color: '#fef3c7',
        border: '1px solid rgba(250,204,21,0.32)',
        backdropFilter: 'blur(12px)',
        fontSize: 12,
        fontWeight: 800,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#facc15',
          boxShadow: '0 0 12px rgba(250,204,21,0.72)',
        }} />
        {label}
      </div>

      <div style={{
        position: 'absolute',
        right: 12,
        top: 12,
        display: 'flex',
        gap: 8,
      }}>
        <button type="button" onClick={onToggleExpanded} style={screenShareActionStyle}>
          {expanded ? 'Reduire' : 'Agrandir'}
        </button>
        <button type="button" onClick={requestFullscreen} style={screenShareActionStyle}>
          Plein ecran
        </button>
      </div>
    </div>
  );
}

export default function LiveKitRoomView({
  roomId,
  userName,
  onFallback,
  onLeave,
  toggleHand,
  handRaised,
  canFallbackToP2P = false,
  onFallbackToP2P,
}) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const [localCameraTrack, setLocalCameraTrack] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const roomRef = useRef(null);
  const fallbackCalledRef = useRef(false);
  const onFallbackRef = useRef(onFallback);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordingCleanupRef = useRef(null);
  const virtualBackground = useLiveKitVirtualBackground(localCameraTrack);

  useEffect(() => {
    onFallbackRef.current = onFallback;
  }, [onFallback]);

  const bump = useCallback(() => setVersion((current) => current + 1), []);

  const triggerFallback = useCallback((reason) => {
    if (fallbackCalledRef.current) return;
    fallbackCalledRef.current = true;
    onFallbackRef.current?.(reason);
  }, []);

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
  const localScreenShareActive = Boolean(screenShareItem?.isLocal);
  const screenShareOwnerName = screenShareItem?.isLocal ? 'Vous' : screenShareItem?.name || '';

  useEffect(() => {
    setLocalCameraTrack(getLocalCameraTrack(room));
  }, [room, version]);

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

  const stopLiveKitRecording = useCallback(() => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
  }, []);

  const startLiveKitRecording = useCallback(() => {
    const activeRoom = roomRef.current;
    if (!activeRoom || recorderRef.current) return;

    const items = collectTrackItems(activeRoom);
    const mainVideoTrack =
      items.find((item) => item.screenTrack)?.screenTrack
      || items.find((item) => item.isLocal && item.videoTrack)?.videoTrack
      || items.find((item) => item.videoTrack)?.videoTrack;
    const videoMediaTrack = getTrackMediaStreamTrack(mainVideoTrack);

    if (!videoMediaTrack) {
      window.alert("Aucune piste video LiveKit disponible pour l'enregistrement.");
      return;
    }

    recordChunksRef.current = [];

    const cleanupFns = [];
    const recordStream = new MediaStream([videoMediaTrack]);
    const audioTracks = items
      .map((item) => item.audioTrack)
      .map(getTrackMediaStreamTrack)
      .filter(Boolean);

    let audioContext = null;
    if (audioTracks.length > 0 && window.AudioContext) {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      audioTracks.forEach((audioTrack) => {
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(destination);
        cleanupFns.push(() => source.disconnect());
      });
      destination.stream.getAudioTracks().forEach((track) => recordStream.addTrack(track));
    } else {
      audioTracks.slice(0, 1).forEach((track) => recordStream.addTrack(track));
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(recordStream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        recordChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `meetra-livekit-${Date.now()}.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      cleanupFns.forEach((cleanup) => cleanup());
      audioContext?.close?.().catch(() => {});
      recorderRef.current = null;
      recordingCleanupRef.current = null;
      setIsRecording(false);
    };

    recorder.onerror = () => {
      cleanupFns.forEach((cleanup) => cleanup());
      audioContext?.close?.().catch(() => {});
      recorderRef.current = null;
      recordingCleanupRef.current = null;
      setIsRecording(false);
    };

    recorderRef.current = recorder;
    recordingCleanupRef.current = () => {
      cleanupFns.forEach((cleanup) => cleanup());
      audioContext?.close?.().catch(() => {});
    };
    recorder.start(1000);
    setIsRecording(true);
  }, []);

  const toggleLiveKitRecording = useCallback(() => {
    if (recorderRef.current) {
      stopLiveKitRecording();
      return;
    }
    startLiveKitRecording();
  }, [startLiveKitRecording, stopLiveKitRecording]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recordingCleanupRef.current?.();
  }, []);

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
              gridTemplateRows: presentationMode ? '1fr' : '1fr 124px',
              gap: 10,
              padding: 10,
            }}>
              <ScreenShareStage
                item={screenShareItem}
                expanded={presentationMode}
                onToggleExpanded={() => setPresentationMode((current) => !current)}
              />
              {!presentationMode && (
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', minHeight: 0 }}>
                  {trackItems.map((item) => (
                    <div key={item.key} style={{ width: 180, height: 112, flexShrink: 0 }}>
                      <LiveKitTile item={item} compact />
                    </div>
                  ))}
                </div>
              )}
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

          <LiveKitControlBar
            roomId={roomId}
            userName={userName}
            localAudioEnabled={localAudioEnabled}
            localVideoEnabled={localVideoEnabled}
            screenShareActive={localScreenShareActive}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={localScreenShareActive ? stopScreenShare : startScreenShare}
            canFallbackToP2P={canFallbackToP2P}
            onFallbackToP2P={onFallbackToP2P}
            onLeave={onLeave}
            toggleHand={toggleHand}
            handRaised={handRaised}
            screenShareOwnerName={screenShareOwnerName}
            presentationMode={presentationMode}
            onTogglePresentationMode={() => setPresentationMode((current) => !current)}
            virtualBackgroundController={virtualBackground}
            isRecording={isRecording}
            onToggleRecording={toggleLiveKitRecording}
          />
        </>
      )}
    </div>
  );
}

const screenShareActionStyle = {
  border: '1px solid rgba(250,204,21,0.32)',
  background: 'rgba(2,6,23,0.78)',
  color: '#fef3c7',
  borderRadius: 999,
  padding: '8px 11px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  backdropFilter: 'blur(12px)',
};
