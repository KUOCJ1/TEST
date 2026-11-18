import { useState } from 'react';
import { formatDate } from '../utils/format';
import { badgeBg } from '../utils/color';
import { badgeText } from '../utils/levelBadge';

/**
 * 「我的歷程」：敘事段落 + 垂直時間軸。取代原本純數字的「作答歷史記錄」表格——
 * 每個節點可點開查看該次的完整報告，並標示與前一次相比的分數變化，讓歷程
 * 不只是一張表，而是看得出走向的故事。
 */
export default function JourneyTimeline({ narrative, submissions, onSelect, profileMode = false, events = [] }) {
  const [showAll, setShowAll] = useState(false);
  if (!submissions?.length) return null;
  const EVENT_LIMIT = 8; // 事件很多時先只看最近 8 筆，作答節點一律全部顯示
  const hiddenCount = showAll ? 0 : Math.max(0, events.length - EVENT_LIMIT);
  const shownEvents = showAll ? events : events.slice(0, EVENT_LIMIT);

  // 作答節點與成長事件（目標、練習、會談、反思）依時間穿插，新到舊。delta 仍以作答陣列的相鄰兩筆計算。
  const nodes = [
    ...submissions.map((s, i) => ({ type: 'sub', s, i, at: new Date(s.createdAt).getTime() })),
    ...shownEvents.map((e) => ({ type: 'ev', e, at: new Date(e.at).getTime() })),
  ].sort((a, b) => b.at - a.at);

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
      <h3 className="mb-1 text-base font-bold text-slate-700">{events.length > 0 ? '我的成長紀錄' : '我的歷程'}</h3>
      {narrative && <p className="mb-5 text-sm leading-relaxed text-slate-600">{narrative}</p>}

      <div className="relative">
        {nodes.length > 1 && (
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />
        )}
        <ol className="space-y-1">
          {nodes.map((n) => {
            if (n.type === 'ev') {
              return (
                <li key={n.e.id} data-testid="growth-event" className="flex items-start gap-4 px-2 py-1.5">
                  <span aria-hidden="true" className="relative z-10 mt-2 ml-[3px] h-2 w-2 shrink-0 rounded-full bg-brass-200 ring-2 ring-brass-100" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="mr-2 text-xs text-slate-400">{formatDate(n.e.at)}</span>
                    <span className="font-medium text-slate-600">{n.e.title}</span>
                    {n.e.detail && <p className="truncate text-xs text-slate-500">{n.e.detail}</p>}
                  </div>
                </li>
              );
            }
            const { s, i } = n;
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
                      {/* PROFILE_MODE：風格沒有高低之分，不顯示總分／百分比／漲跌，只呈現
                          當次的風格徽章——顯示數字或綠紅漲跌會暗示「分數越高越好」。 */}
                      {!profileMode && (
                        <>
                          <span className="text-lg font-bold text-slate-800">{s.result.total}</span>
                          <span className="text-xs text-slate-400">{s.result.percent}%</span>
                        </>
                      )}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: badgeBg(s.result.level.color) }}
                      >
                        {badgeText(s.result.level.badge)}
                      </span>
                      {!profileMode && delta !== null && delta !== 0 && (
                        <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {delta > 0 ? `▲ +${delta}` : `▽ ${delta}`}
                        </span>
                      )}
                      {profileMode && prev && prev.result.level.badge !== s.result.level.badge && (
                        <span className="text-xs font-semibold text-slate-400">
                          ← {badgeText(prev.result.level.badge)}
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
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
          顯示更早的 {hiddenCount} 筆紀錄
        </button>
      )}
    </section>
  );
}
