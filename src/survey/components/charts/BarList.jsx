/**
 * 通用水平長條清單。
 * @param {Array<{label, sublabel?, percent, color, valueText?}>} items
 */
export default function BarList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id ?? i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              <span className="font-semibold" style={{ color: it.color }}>
                {it.label}
              </span>
              {it.sublabel && <span className="ml-2 text-slate-400">{it.sublabel}</span>}
            </span>
            <span className="font-semibold text-slate-600">{it.valueText ?? `${it.percent}%`}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, it.percent))}%`, background: it.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
