import { useUI } from '../../context/UIContext.jsx';

export default function ReactionsOverlay() {
  const { reactions } = useUI();

  if (!reactions.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-6 top-24 z-[1400] flex w-[min(360px,calc(100vw-32px))] flex-col gap-3"
      aria-hidden="true"
    >
      {reactions.map((reaction, index) => (
        <ReactionToast key={reaction.id} reaction={reaction} index={index} />
      ))}
    </div>
  );
}

function ReactionToast({ reaction, index }) {
  return (
    <div
      className="overflow-hidden rounded-[22px] border border-white/12 bg-slate-950/92 shadow-[0_28px_70px_rgba(2,6,23,0.55)] backdrop-blur-2xl"
      style={{
        animation: 'reactionToastIn 3.5s ease forwards',
        transformOrigin: 'top right',
      }}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-4xl"
          style={{ boxShadow: '0 16px 32px rgba(0,0,0,0.28)' }}
        >
          {reaction.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-blue-300/90">
            Réaction
          </div>
          <div className="mt-1 truncate text-base font-semibold text-white">
            {reaction.userName || 'Participant'}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            a envoyé {reaction.emoji}
          </div>
        </div>
      </div>

      <div className="h-1 w-full overflow-hidden bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300"
          style={{
            animation: 'reactionProgress 3.5s linear forwards',
            animationDelay: `${index * 0.03}s`,
          }}
        />
      </div>

      <style>{`
        @keyframes reactionToastIn {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.94);
          }
          10% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          82% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
        }
        @keyframes reactionProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
