import { useUI } from '../../context/UIContext.jsx';

export default function ReactionsOverlay() {
  const { reactions } = useUI();

  // Always render the container so it's in the DOM
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {reactions.map(r => (
        <ReactionBubble key={r.id} reaction={r} />
      ))}
    </div>
  );
}

function ReactionBubble({ reaction }) {
  // Random horizontal position so multiple reactions don't stack
  const left = 30 + Math.random() * 40; // 30%–70% of viewport width

  return (
    <div
      className="absolute bottom-28 flex flex-col items-center gap-1"
      style={{
        left: `${left}%`,
        transform: 'translateX(-50%)',
        animation: 'reactionFloat 3.5s ease-out forwards',
      }}
    >
      <span className="text-5xl drop-shadow-lg" style={{ lineHeight: 1 }}>
        {reaction.emoji}
      </span>
      <span
        className="text-white text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      >
        {reaction.userName}
      </span>

      <style>{`
        @keyframes reactionFloat {
          0%   { opacity: 0;   transform: translateX(-50%) translateY(0)    scale(0.5); }
          15%  { opacity: 1;   transform: translateX(-50%) translateY(-10px) scale(1.2); }
          80%  { opacity: 1;   transform: translateX(-50%) translateY(-120px) scale(1); }
          100% { opacity: 0;   transform: translateX(-50%) translateY(-160px) scale(0.8); }
        }
      `}</style>
    </div>
  );
}
