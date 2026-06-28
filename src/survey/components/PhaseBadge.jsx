const PHASE_CONFIG = {
  not_started: { label: '尚未開始', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
  in_progress: { label: '進行中',   className: 'bg-green-50  text-green-700  ring-green-200' },
  closed:      { label: '教練審閱中', className: 'bg-amber-50  text-amber-700  ring-amber-200' },
  published:   { label: '開放閱覽', className: 'bg-blue-50   text-blue-700   ring-blue-200' },
};

export default function PhaseBadge({ phase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.not_started;
  return (
    <span className={`chip ring-1 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
