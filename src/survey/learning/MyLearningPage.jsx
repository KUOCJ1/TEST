import { useEffect, useState } from 'react';
import { BookOpen, Check, ExternalLink, Target, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../utils/format';
import LoadingState from '../components/LoadingState';

/**
 * 「我的學習」：把目前散落在各評量報告頁的「發展目標」與「延伸閱讀學習清單」
 * 彙整到同一頁，回答「我到底安排了哪些學習、進度到哪了」——見
 * docs/SPRINT_PLAN.md Sprint 3（3.3）。目標與清單本身的建立/編輯還是在
 * ResultPanel／LearningResources 進行，這裡是總覽 + 管理（標記已讀、移除）。
 */
export default function MyLearningPage() {
  const [goals, setGoals] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.myGoals(), api.myReadingList()])
      .then(([g, i]) => { if (active) { setGoals(g); setItems(i); } })
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  const toggleRead = async (item) => {
    const updated = await api.markReadingListItem(item.id, !item.read).catch(() => null);
    if (updated) setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  };

  const removeItem = async (item) => {
    await api.removeReadingListItem(item.id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-red-500">{error}</p>;
  }
  if (goals === null || items === null) return <LoadingState />;

  const inProgress = goals.filter((g) => !g.achievedAt);
  const achieved = goals.filter((g) => g.achievedAt);
  const unread = items.filter((i) => !i.read);
  const read = items.filter((i) => i.read);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">我的學習</h2>
        <p className="mt-1 text-sm text-slate-500">
          彙整你在各評量報告裡設定的發展目標，與從延伸閱讀加入的學習清單。
        </p>
      </header>

      <section className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        <h3 className="mb-4 flex items-center gap-1.5 text-base font-bold text-slate-700">
          <Target className="h-4 w-4 text-brass-500" /> 進行中目標（{inProgress.length}）
        </h3>
        {inProgress.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            還沒有進行中的目標。完成一次評測後，到報告頁的「我的發展目標」訂一個吧。
          </p>
        ) : (
          <ul className="space-y-3">
            {inProgress.map((g) => {
              const doneCount = g.actions.filter((a) => a.done).length;
              return (
                <li key={g.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  {g.dimensionName && (
                    <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                      {g.dimensionName}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-slate-700">{g.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    設定於 {formatDate(g.createdAt)}
                    {g.actions.length > 0 && ` · 行動 ${doneCount}/${g.actions.length}`}
                    {g.reviewDate && ` · 建議 ${formatDate(g.reviewDate)} 前回來複測`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {achieved.length > 0 && (
          <p className="mt-4 text-xs text-slate-400">另有 {achieved.length} 個已達成的目標，可在各評量報告頁查看完整記錄。</p>
        )}
      </section>

      <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        <h3 className="mb-4 flex items-center gap-1.5 text-base font-bold text-slate-700">
          <BookOpen className="h-4 w-4 text-brass-500" /> 學習清單（未讀 {unread.length}）
        </h3>
        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            還沒有加入任何文章。在評量報告的「延伸閱讀」區塊點「加入清單」即可收藏。
          </p>
        ) : (
          <ul className="space-y-2">
            {[...unread, ...read].map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleRead(item)}
                  aria-label={item.read ? '標記為未讀' : '標記為已讀'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    item.read ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                  }`}
                >
                  {item.read && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-sm font-semibold hover:text-brass-700 ${item.read ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                  >
                    {item.title} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {item.dimensionName && (
                    <p className="mt-0.5 text-xs text-slate-400">{item.dimensionName} · 加入於 {formatDate(item.addedAt)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  aria-label="移除"
                  className="btn-icon shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
