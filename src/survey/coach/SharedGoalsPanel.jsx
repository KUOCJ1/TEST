import { Target } from 'lucide-react';
import { formatDate } from '../utils/format';

const RATING = { 1: '幾乎沒做', 2: '做了一點', 3: '做了一半', 4: '大多有做', 5: '都有做到' };

/**
 * 學員「選擇分享給教練」的發展目標（預設私密，沒分享的完全看不到）。
 * 教練可以看到目標、行動完成度、設定時的基準與最近一次自評；追蹤筆記永遠只有學員自己看得到。
 */
export default function SharedGoalsPanel({ goals }) {
  const byUser = new Map();
  goals.forEach((g) => { (byUser.get(g.userId) ?? byUser.set(g.userId, []).get(g.userId)).push(g); });

  return (
    <section aria-label="學員分享的發展目標" className="panel">
      <h3 className="mb-1 flex items-center gap-1.5 text-base font-bold text-slate-700">
        <Target className="h-4 w-4 text-brass-500" /> 學員分享給你的發展目標
        <span className="text-xs font-normal text-slate-400">（{goals.length}）</span>
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        學員可以自己決定要不要分享，沒有分享的目標你看不到。這裡不含學員的追蹤筆記。適合在課後對話時關心進度與提供支持。
      </p>
      {goals.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">還沒有學員分享目標。你可以在課後提醒學員：訂好目標後，可以選擇分享給教練。</p>
      ) : (
        <ul className="space-y-3">
          {[...byUser.values()].map((list) => (
            <li key={list[0].userId} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="mb-2 text-sm font-bold text-slate-700">{list[0].userName || '（未具名）'}</p>
              <ul className="space-y-2">
                {list.map((g) => {
                  const done = g.actions.filter((a) => a.done).length;
                  return (
                    <li key={g.id} className="text-sm">
                      {g.dimensionName && <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{g.dimensionName}</span>}
                      <span className={g.achievedAt ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-700'}>{g.text}</span>
                      <p className="mt-0.5 text-xs text-slate-400">
                        行動 {done}/{g.actions.length}
                        {g.achievedAt ? ` · 已於 ${formatDate(g.achievedAt)} 達成` : g.reviewDate ? ` · 預計 ${formatDate(g.reviewDate)} 檢視` : ''}
                        {g.checkinCount > 0 && ` · 已記錄 ${g.checkinCount} 次`}
                        {g.lastCheckin?.rating && `（最近一次自評：${RATING[g.lastCheckin.rating]}）`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
