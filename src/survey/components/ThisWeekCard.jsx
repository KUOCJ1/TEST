import { useEffect, useState } from 'react';
import { Footprints, Check, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { buildThisWeek } from '../utils/thisWeek.js';

// 首頁「這週你的小步」：取代原本分散的「我的目標」「本週微練習」「待填會後反思」三條。
// 本週微練習可以直接在這裡按「我做了」；其他一步到位去「我的學習」。沒有任何待辦時整張卡不出現。
export default function ThisWeekCard({ goals, onGoLearning }) {
  const [practice, setPractice] = useState(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    let alive = true;
    api.myPractice().then((p) => alive && setPractice(p)).catch(() => {});
    api.myReflections().then((s) => alive && setPending(s.filter((x) => !x.reflection).length)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const items = buildThisWeek({ practice, reflectionsPending: pending, goals });
  if (items.length === 0 && !justDone) return null;

  const markDone = async (week) => {
    setBusy(true);
    try { setPractice(await api.markPracticeWeek(week, true)); setJustDone(true); } finally { setBusy(false); }
  };

  return (
    <section aria-label="這週你的小步" className="mb-6 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-brass-200 sm:px-5">
      <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold text-ink-700"><Footprints className="h-5 w-5 text-brass-500" aria-hidden="true" /> 這週你的小步</h3>
      {justDone && items.every((i) => i.id !== 'practice') && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" aria-hidden="true" /> 本週的小步完成了，做得好。</p>
      )}
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{it.title}</p>
              {it.detail && <p className="mt-0.5 text-sm text-slate-600">{it.detail}</p>}
            </div>
            {it.action === 'mark-practice' ? (
              <button type="button" disabled={busy} onClick={() => markDone(it.week)} className="btn-primary btn-sm shrink-0">
                <Check className="h-4 w-4" aria-hidden="true" /> 我做了
              </button>
            ) : (
              <button type="button" onClick={onGoLearning} aria-label={`${it.title}，前往我的學習`} className="btn-ghost btn-sm shrink-0">
                前往 <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
