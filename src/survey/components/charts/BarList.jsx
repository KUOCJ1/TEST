/**
 * 通用水平長條清單。
 * @param {Array<{label, sublabel?, percent, color, labelColor?, valueText?}>} items
 *   labelColor 預設同 color；傳 'inherit' 讓標籤跟隨一般文字色（深色模式會自動
 *   提亮），適合長條色在深底上對比不足、但標籤文字仍需清楚的情況。
 */
export default function BarList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id ?? i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              <span className="font-semibold" style={{ color: it.labelColor ?? it.color }}>
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
