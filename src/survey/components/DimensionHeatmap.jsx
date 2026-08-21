// 構面 × 成員熱力圖：橫軸是構面、縱軸是成員，色深代表該構面的分數高低。
// 用意是讓教練一眼看出「這班哪個構面弱、是被誰拉低的」，不必逐一點開每個人的雷達圖比對。
function cellTone(percent) {
  if (percent == null) return { bg: '#f1f5f6', text: '#94a3b8' };
  if (percent < 60) return { bg: '#f5e1df', text: '#a92f28' };
  if (percent < 80) return { bg: '#f6ead8', text: '#96601e' };
  return { bg: '#dcefe6', text: '#1e7a52' };
}

export default function DimensionHeatmap({ dimensions, memberRows }) {
  if (!dimensions?.length || !memberRows?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-1 font-semibold text-slate-700">構面 × 成員熱力圖</h4>
      <p className="mb-3 text-xs text-slate-400">色塊越紅代表該構面分數越低，越綠代表越高——用來快速定位弱項與是誰拉低的。</p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate text-sm" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-white py-1.5 pr-3 text-left text-xs font-medium text-slate-500">成員</th>
              {dimensions.map((d) => (
                <th key={d.id} className="min-w-[64px] px-1 py-1.5 text-center text-xs font-medium text-slate-500">
                  {d.subtitle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberRows.map((r) => (
              <tr key={r.userId}>
                <td className="sticky left-0 whitespace-nowrap bg-white py-1 pr-3 text-sm font-medium text-slate-700">
                  {r.name}
                </td>
                {dimensions.map((d) => {
                  const percent = r.submission.result.dimensions.find((x) => x.id === d.id)?.percent ?? null;
                  const tone = cellTone(percent);
                  return (
                    <td key={d.id} className="p-0 text-center">
                      <div
                        className="rounded-sm py-1.5 text-xs font-semibold tabular-nums"
                        style={{ background: tone.bg, color: tone.text }}
                      >
                        {percent == null ? '—' : `${percent}%`}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
