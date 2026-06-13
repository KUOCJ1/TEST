/**
 * 落點等級人數分佈（水平堆疊長條 + 圖例）。
 * @param {Array<{id, badge, color, count}>} distribution
 */
export default function LevelDistribution({ distribution }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
        {total === 0
          ? null
          : distribution.map((d) =>
              d.count > 0 ? (
                <div
                  key={d.id}
                  className="h-full"
                  style={{ width: `${(d.count / total) * 100}%`, background: d.color }}
                  title={`${d.badge}: ${d.count}`}
                />
              ) : null,
            )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {distribution.map((d) => (
          <li key={d.id} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: d.color }} />
              {d.badge}
            </span>
            <span className="font-semibold text-slate-700">
              {d.count}
              <span className="ml-1 text-xs font-normal text-slate-400">
                （{total ? Math.round((d.count / total) * 100) : 0}%）
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
