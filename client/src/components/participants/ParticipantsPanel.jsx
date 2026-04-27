import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useUI } from '../../context/UIContext.jsx';
import { EVENTS } from '../../utils/events.js';
import { BanIcon, CameraOffIcon, CloseIcon, CrownIcon, HandIcon, MicOffIcon, UsersIcon } from '../common/AppIcons.jsx';

function EmptyState() {
  return (
    <div className="meetra-empty-state mt-4">
      <h4>Aucun autre participant</h4>
      <p className="text-sm leading-6 text-slate-400">Les collègues admis apparaîtront ici avec leur statut micro, caméra et main levée.</p>
    </div>
  );
}

function ParticipantItem({ name, isHost, isCoHost, isLocal, audioEnabled = true, videoEnabled = true, handRaised, canControl, canManageRoles, onMute, onKick, onAssignHost, onAssignCoHost, onRemoveCoHost }) {
  return (
    <div className="group rounded-[20px] border border-white/8 bg-white/[0.03] px-3 py-3 transition hover:bg-white/[0.05]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white">
          {name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {name}
            {isLocal && <span className="ml-1 text-xs font-medium text-slate-400">(vous)</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            {isHost && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-amber-200">
                <CrownIcon size={12} color="currentColor" />
                Hôte
              </span>
            )}
            {!isHost && isCoHost && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-blue-200">
                <CrownIcon size={12} color="currentColor" />
                Co-hôte
              </span>
            )}
            {handRaised && (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2 py-1 text-yellow-200">
                <HandIcon size={12} color="currentColor" />
                Main levée
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!audioEnabled && <span className="rounded-full bg-red-500/12 p-2 text-red-300"><MicOffIcon size={13} color="currentColor" /></span>}
          {!videoEnabled && <span className="rounded-full bg-red-500/12 p-2 text-red-300"><CameraOffIcon size={13} color="currentColor" /></span>}
        </div>
      </div>

      {canControl && (
        <div className="mt-3 hidden items-center gap-2 group-hover:flex">
          <button onClick={onMute} className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200">
            Couper micro
          </button>
          {canManageRoles && (
            <>
              <button onClick={onAssignHost} className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-amber-200">
                Nommer hôte
              </button>
              {isCoHost ? (
                <button onClick={onRemoveCoHost} className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-blue-200">
                  Retirer co-hôte
                </button>
              ) : (
                <button onClick={onAssignCoHost} className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-blue-200">
                  Nommer co-hôte
                </button>
              )}
            </>
          )}
          <button onClick={onKick} className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-red-200">
            Expulser
          </button>
        </div>
      )}
    </div>
  );
}

export default function ParticipantsPanel({ roomId }) {
  const { participants, hostId, coHostIds } = useRoom();
  const { socket } = useSocket();
  const { participantsOpen, setParticipantsOpen } = useUI();

  const iAmHost = socket?.id === hostId;
  const iAmCoHost = coHostIds.includes(socket?.id);
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1100 : false));

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const assignCoHost = (targetSocketId) => {
    socket.emit(EVENTS.ASSIGN_COHOST, { roomId, targetSocketId });
  };

  const removeCoHost = (targetSocketId) => {
    socket.emit(EVENTS.REMOVE_COHOST, { roomId, targetSocketId });
  };

  return (
    <aside
      className={`meetra-surface flex flex-col transition-all duration-200 ${
        isCompact
          ? `${participantsOpen ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'} fixed inset-y-0 right-0 z-[90] w-full max-w-[360px] border-l border-white/10`
          : `${participantsOpen ? 'w-[310px] border-l border-white/10' : 'w-0 overflow-hidden border-l-0'} h-full`
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div>
          <div className="meetra-section-label">Présence</div>
          <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
            <UsersIcon size={15} />
            Participants ({participants.length + 1})
          </h3>
        </div>
        <button onClick={() => setParticipantsOpen(false)} className="meetra-focus-ring rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        <ParticipantItem
          name="Vous"
          isHost={socket?.id === hostId}
          isCoHost={coHostIds.includes(socket?.id)}
          isLocal
        />

        {participants.length === 0 ? (
          <EmptyState />
        ) : (
          participants.map((participant) => (
            <ParticipantItem
              key={participant.socketId}
              name={participant.name}
              isHost={participant.socketId === hostId}
              isCoHost={coHostIds.includes(participant.socketId)}
              audioEnabled={participant.audioEnabled}
              videoEnabled={participant.videoEnabled}
              handRaised={participant.handRaised}
              canControl={(iAmHost || iAmCoHost) && participant.socketId !== socket?.id}
              canManageRoles={iAmHost}
              onMute={() => muteUser(participant.socketId)}
              onKick={() => kickUser(participant.socketId)}
              onAssignHost={() => assignHost(participant.socketId)}
              onAssignCoHost={() => assignCoHost(participant.socketId)}
              onRemoveCoHost={() => removeCoHost(participant.socketId)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
