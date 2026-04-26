import { useRoom }   from '../../context/RoomContext.jsx';
import { useSocket }  from '../../context/SocketContext.jsx';
import { useUI }      from '../../context/UIContext.jsx';
import { EVENTS }     from '../../utils/events.js';
import { BanIcon, CameraOffIcon, CloseIcon, CrownIcon, HandIcon, MicOffIcon, UsersIcon } from '../common/AppIcons.jsx';

export default function ParticipantsPanel({ roomId }) {
  const { participants, hostId } = useRoom();
  const { socket }               = useSocket();
  const { participantsOpen, setParticipantsOpen } = useUI();

  const iAmHost = socket?.id === hostId;

  const muteUser = (targetSocketId) => {
    socket.emit(EVENTS.MUTE_USER, { roomId, targetSocketId });
  };

  const kickUser = (targetSocketId) => {
    if (window.confirm('Expulser ce participant ?')) {
      socket.emit(EVENTS.KICK_USER, { roomId, targetSocketId });
    }
  };

  const assignHost = (targetSocketId) => {
    socket.emit(EVENTS.ASSIGN_HOST, { roomId, targetSocketId });
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 border-l border-gray-700 transition-all duration-200 ${participantsOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="flex items-center gap-2 text-white font-semibold text-sm">
          <UsersIcon size={15} />
          Participants ({participants.length + 1})
        </h3>
        <button onClick={() => setParticipantsOpen(false)} className="text-gray-400 hover:text-white">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Local user always first */}
        <ParticipantItem
          name="Vous"
          isHost={socket?.id === hostId}
          isLocal
        />

        {participants.map(p => (
          <ParticipantItem
            key={p.socketId}
            name={p.name}
            isHost={p.socketId === hostId}
            audioEnabled={p.audioEnabled}
            videoEnabled={p.videoEnabled}
            handRaised={p.handRaised}
            canControl={iAmHost && p.socketId !== socket?.id}
            onMute={()       => muteUser(p.socketId)}
            onKick={()       => kickUser(p.socketId)}
            onAssignHost={() => assignHost(p.socketId)}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantItem({ name, isHost, isLocal, audioEnabled = true, videoEnabled = true, handRaised, canControl, onMute, onKick, onAssignHost }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 group">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">
          {name}
          {isHost  && <span className="ml-1 inline-flex align-middle text-yellow-400"><CrownIcon size={12} color="currentColor" /></span>}
          {isLocal && <span className="ml-1 text-gray-400 text-xs">(vous)</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs shrink-0">
        {!audioEnabled && <span className="text-red-400"><MicOffIcon size={13} color="currentColor" /></span>}
        {!videoEnabled && <span className="text-red-400"><CameraOffIcon size={13} color="currentColor" /></span>}
        {handRaised    && <span className="text-yellow-400"><HandIcon size={13} color="currentColor" /></span>}
      </div>
      {canControl && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button onClick={onMute} title="Couper micro" className="text-gray-400 hover:text-white px-1">
            <MicOffIcon size={13} color="currentColor" />
          </button>
          <button onClick={onKick} title="Expulser" className="text-gray-400 hover:text-red-400 px-1">
            <BanIcon size={13} color="currentColor" />
          </button>
          <button onClick={onAssignHost} title="Nommer hôte" className="text-gray-400 hover:text-yellow-400 px-1">
            <CrownIcon size={13} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  );
}
