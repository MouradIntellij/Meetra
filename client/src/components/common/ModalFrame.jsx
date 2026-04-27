export default function ModalFrame({
  onClose,
  title,
  subtitle,
  badge,
  icon,
  children,
  widthClass = 'max-w-4xl',
  contentClassName = '',
  bodyClassName = '',
  bodyPaddingClass = 'px-6 py-5',
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-md"
      onClick={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div className={`meetra-surface flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[30px] ${widthClass} ${contentClassName}`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            {badge && <div className="meetra-section-label">{badge}</div>}
            <div className="mt-2 flex items-center gap-3">
              {icon && <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-blue-500/14 text-blue-100">{icon}</div>}
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="meetra-focus-ring flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyPaddingClass} ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
