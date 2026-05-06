import { useUI } from '../../context/UIContext.jsx';
import ReactionBar from '../controls/ReactionBar.jsx';
import {
  CameraOffIcon,
  ChatBubbleIcon,
  ComputerIcon,
  DoorExitIcon,
  HandIcon,
  MicOffIcon,
  TranscriptIcon,
  UsersIcon,
  VideoAppIcon,
  WhiteboardIcon,
} from '../common/AppIcons.jsx';

function ControlButton({
  icon,
  label,
  title,
  onClick,
  active = false,
  danger = false,
  muted = false,
  badge = 0,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      style={{
        position: 'relative',
        minWidth: 62,
        minHeight: 56,
        borderRadius: 16,
        border: danger
          ? '1px solid rgba(248,113,113,0.34)'
          : active
            ? '1px solid rgba(96,165,250,0.34)'
            : '1px solid rgba(255,255,255,0.1)',
        background: danger
          ? '#dc2626'
          : active
            ? 'rgba(37,99,235,0.26)'
            : muted
              ? 'rgba(127,29,29,0.36)'
              : 'rgba(15,23,42,0.86)',
        color: danger ? '#fff' : active ? '#bfdbfe' : muted ? '#fecaca' : '#dbeafe',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '8px 10px',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1,
        boxShadow: active ? '0 14px 30px rgba(37,99,235,0.18)' : 'none',
        transition: 'background 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
      }}
    >
      {badge > 0 && (
        <span style={{
          position: 'absolute',
          right: -4,
          top: -5,
          minWidth: 19,
          height: 19,
          borderRadius: 999,
          padding: '0 5px',
          background: '#ef4444',
          border: '2px solid #020617',
          color: '#fff',
          fontSize: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <span style={{ display: 'inline-flex' }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function Divider() {
  return (
    <div style={{
      width: 1,
      height: 42,
      background: 'rgba(255,255,255,0.1)',
      flexShrink: 0,
    }} />
  );
}

export default function LiveKitControlBar({
  roomId,
  userName,
  localAudioEnabled,
  localVideoEnabled,
  screenShareActive,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onFallbackToP2P,
  onLeave,
  toggleHand,
  handRaised,
}) {
  const {
    chatOpen,
    setChatOpen,
    chatUnread,
    participantsOpen,
    setParticipantsOpen,
    whiteboardOpen,
    setWhiteboardOpen,
    transcriptOpen,
    setTranscriptOpen,
  } = useUI();

  return (
    <div style={{
      flexShrink: 0,
      minHeight: 86,
      borderTop: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(180deg, rgba(2,6,23,0.9) 0%, rgba(15,23,42,0.96) 100%)',
      boxShadow: '0 -18px 50px rgba(2,6,23,0.42)',
      backdropFilter: 'blur(18px)',
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ControlButton
            onClick={onToggleAudio}
            active={localAudioEnabled}
            muted={!localAudioEnabled}
            icon={<MicOffIcon size={18} />}
            label={localAudioEnabled ? 'Micro' : 'Muet'}
            title={localAudioEnabled ? 'Couper le micro LiveKit' : 'Activer le micro LiveKit'}
          />
          <ControlButton
            onClick={onToggleVideo}
            active={localVideoEnabled}
            muted={!localVideoEnabled}
            icon={localVideoEnabled ? <VideoAppIcon size={18} /> : <CameraOffIcon size={18} />}
            label={localVideoEnabled ? 'Camera' : 'Camera off'}
            title={localVideoEnabled ? 'Couper la camera LiveKit' : 'Activer la camera LiveKit'}
          />
          <ControlButton
            onClick={onToggleScreenShare}
            active={screenShareActive}
            icon={<ComputerIcon size={18} />}
            label={screenShareActive ? 'Stop partage' : 'Partager'}
            title={screenShareActive ? 'Arreter le partage LiveKit' : 'Partager votre ecran avec LiveKit'}
          />
        </div>

        <Divider />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ControlButton
            onClick={toggleHand}
            active={handRaised}
            icon={<HandIcon size={18} />}
            label={handRaised ? 'Main levee' : 'Lever main'}
            title={handRaised ? 'Baisser la main' : 'Lever la main'}
          />
          <ReactionBar roomId={roomId} userName={userName} toggleHand={toggleHand} handRaised={handRaised} />
        </div>

        <Divider />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ControlButton
            onClick={() => setParticipantsOpen((open) => !open)}
            active={participantsOpen}
            icon={<UsersIcon size={18} />}
            label="Participants"
          />
          <ControlButton
            onClick={() => setChatOpen((open) => !open)}
            active={chatOpen}
            icon={<ChatBubbleIcon size={18} />}
            label="Chat"
            badge={chatUnread}
          />
          <ControlButton
            onClick={() => setTranscriptOpen((open) => !open)}
            active={transcriptOpen}
            icon={<TranscriptIcon size={18} />}
            label="Transcript"
          />
          <ControlButton
            onClick={() => setWhiteboardOpen((open) => !open)}
            active={whiteboardOpen}
            icon={<WhiteboardIcon size={18} />}
            label="Tableau"
          />
        </div>

        <Divider />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ControlButton
            onClick={onFallbackToP2P}
            icon={<VideoAppIcon size={18} />}
            label="Mode P2P"
            title="Basculer vers le mode WebRTC P2P"
          />
          <ControlButton
            onClick={onLeave}
            icon={<DoorExitIcon size={18} />}
            label="Quitter"
            danger
          />
        </div>
      </div>
    </div>
  );
}
