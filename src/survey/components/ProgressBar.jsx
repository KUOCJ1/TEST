/**
 * 置頂的作答進度條，隨捲動固定於頂端。
 */
export default function ProgressBar({ answered, total }) {
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  const done = answered === total;

  return (
    <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur sm:rounded-t-2xl">
      <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-600">
        <span>作答進度</span>
        <span className={done ? 'text-ink-700' : 'text-slate-500'}>
          {answered} / {total} 題{done && ' ✓ 已完成'}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="作答進度"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            done ? 'bg-ink-700' : 'bg-brass-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
