import { formatDate } from '../utils/format';

/**
 * 「我的歷程」：敘事段落 + 垂直時間軸。取代原本純數字的「作答歷史記錄」表格——
 * 每個節點可點開查看該次的完整報告，並標示與前一次相比的分數變化，讓歷程
 * 不只是一張表，而是看得出走向的故事。
 */
export default function JourneyTimeline({ narrative, submissions, onSelect }) {
  if (!submissions?.length) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
      <h3 className="mb-1 text-base font-bold text-slate-700">我的歷程</h3>
      {narrative && <p className="mb-5 text-sm leading-relaxed text-slate-600">{narrative}</p>}

      <div className="relative">
        {submissions.length > 1 && (
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />
        )}
        <ol className="space-y-1">
          {submissions.map((s, i) => {
            const prev = submissions[i + 1]; // 陣列新到舊排序，i+1 是時間上更早的一筆
            const delta = prev ? s.result.total - prev.result.total : null;
            const isLatest = i === 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex w-full items-start gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${
                      isLatest ? 'bg-ink-700' : 'bg-white ring-2 ring-slate-300'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{formatDate(s.createdAt)}</span>
                      {s.phase === 'pre' && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">課前</span>
                      )}
                      {s.phase === 'post' && (
                        <span className="rounded bg-brass-100 px-1.5 py-0.5 text-xs font-medium text-brass-600">課後</span>
                      )}
                      {!prev && submissions.length > 1 && (
                        <span className="text-xs text-slate-400">起點</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-lg font-bold text-slate-800">{s.result.total}</span>
                      <span className="text-xs text-slate-400">{s.result.percent}%</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: s.result.level.color }}
                      >
                        {s.result.level.badge}
                      </span>
                      {delta !== null && delta !== 0 && (
                        <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {delta > 0 ? `▲ +${delta}` : `▽ ${delta}`}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
