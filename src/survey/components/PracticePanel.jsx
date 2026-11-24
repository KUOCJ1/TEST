import { useContext, useEffect, useState } from 'react';
import { CalendarCheck, Check, Lock } from 'lucide-react';
import { api } from '../api/client';
import { buildPracticeTasks, PRACTICE_WEEKS } from '../utils/practice.js';
import { focusDimension } from '../utils/focus.js';
import { dimLabel } from '../utils/dimensionLabel';
import { ConfirmContext } from './useConfirm';
import TrialLock from '../trial/TrialLock';
import { useIsTrial } from '../trial/useIsTrial';

// 課後四週微練習（Sprint 38）：學員自己開啟；每週一個約 5 分鐘的小練習，做完勾一下。
// - 結果頁（offerFrom＝這次的結果）：還沒開始時邀請開始；已經在進行時只顯示精簡狀態。
// - 我的學習（不帶 offerFrom）：顯示四週清單、勾選、結束。
function PracticePanelInner({ offerFrom = null, compact = false }) {
  const [p, setP] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 在 ConfirmProvider 之外（例如單獨渲染結果頁）退回瀏覽器原生確認框，不讓整頁壞掉。
  const confirm = useContext(ConfirmContext) ?? ((o) => Promise.resolve(window.confirm(o.message)));

  useEffect(() => {
    let alive = true;
    api.myPractice().then((x) => alive && setP(x)).catch(() => alive && setP(null));
    return () => { alive = false; };
  }, []);

  if (p === undefined) return null;
  const focus = offerFrom ? focusDimension(offerFrom.dimensions) : null;
  const run = async (fn) => { setBusy(true); setError(''); try { setP(await fn()); } catch (e) { setError(e.message || '操作失敗，請稍後再試'); } finally { setBusy(false); } };

  const shell = (children) => (
    <section aria-label="四週微練習" className={`rounded-2xl border border-ink-700/15 bg-white px-5 py-4 ${offerFrom ? 'mx-5 mt-5 print:hidden sm:mx-7' : 'mb-6'}`}>
      <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold text-ink-700"><CalendarCheck className="h-5 w-5" aria-hidden="true" /> 四週微練習</h3>
      {children}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );

  // 沒有進行中的一組：結果頁邀請開始；我的學習頁說明怎麼開始。
  if (!p?.active) {
    if (!offerFrom) {
      return shell(
        <p className="mt-2 text-sm text-slate-600">
          {p?.finished ? '上一組四週微練習已經完成。' : p?.stoppedAt ? '上一組微練習已結束。' : ''}
          完成一份評量後，在結果頁按「開始四週微練習」：每週一個約 5 分鐘的小練習，針對你最值得先練的構面。
        </p>,
      );
    }
    if (!focus) return null;
    const tasks = buildPracticeTasks(offerFrom.assessmentId, focus.id);
    // 開始的當下才查目標：學員可能剛在上面的「選一件事」建好目標，第一週就接在那件事上。
    const start = async () => {
      const goals = await api.myGoals(offerFrom.assessmentId).catch(() => []);
      const goal = goals.find((g) => !g.achievedAt && g.dimensionId === focus.id);
      const real = buildPracticeTasks(offerFrom.assessmentId, focus.id, (goal?.actions ?? []).filter((a) => !a.done).map((a) => a.text));
      return api.startPractice({ assessmentId: offerFrom.assessmentId, dimensionId: focus.id, dimensionName: dimLabel(focus), tasks: real, goalId: goal?.id });
    };
    return shell(
      <>
        <p className="mt-1 text-slate-700">接下來四週，每週一個約 5 分鐘的小練習，練「{dimLabel(focus)}」。做完勾一下就好，第 2–4 週會寄信提醒本週內容。</p>
        <p className="mt-1 text-sm text-slate-500">第一週就從你在上面「選一件事」選的那件事開始；還沒選的話，從這件開始：{tasks[0]}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} className="btn-primary" onClick={() => run(start)}>
            開始四週微練習
          </button>
          <span className="text-xs text-slate-500">只有你自己看得到；隨時可以在「我的學習」結束。</span>
        </div>
      </>,
    );
  }

  const thisWeek = p.weeks[p.currentWeek - 1];
  if (compact) {
    return shell(
      <p className="mt-1 text-slate-700">
        你正在進行「{p.dimensionName}」的四週微練習，目前第 {p.currentWeek}／{PRACTICE_WEEKS} 週{thisWeek?.doneAt ? '，本週已完成' : `：${thisWeek?.task}`}。
        <a href="/learning" className="tap ml-1 font-semibold text-brass-600 underline">到我的學習勾選</a>
      </p>,
    );
  }

  return shell(
    <>
      <p className="mt-1 text-sm text-slate-500">主題：{p.dimensionName ?? '—'}&emsp;目前第 {p.currentWeek}／{PRACTICE_WEEKS} 週</p>
      <ol className="mt-3 space-y-2">
        {p.weeks.map((w) => (
          <li key={w.week} className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 ${w.week === p.currentWeek ? 'bg-brass-50 ring-1 ring-brass-200' : 'bg-slate-50'}`}>
            <span className="mt-0.5 w-12 shrink-0 text-sm font-semibold text-slate-500">第 {w.week} 週</span>
            {w.task ? (
              <>
                <span className={`min-w-0 flex-1 basis-40 ${w.doneAt ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{w.task}{w.goalLinked && <span className="ml-1.5 whitespace-nowrap text-xs text-slate-400">（也是你目標裡的行動）</span>}</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={Boolean(w.doneAt)}
                  aria-label={`第 ${w.week} 週${w.doneAt ? '已完成，按一下取消' : '標記為完成'}`}
                  onClick={() => run(() => api.markPracticeWeek(w.week, !w.doneAt))}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold max-sm:ml-[3.75rem] ${w.doneAt ? 'bg-emerald-50 text-emerald-700' : 'btn-secondary btn-sm'}`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" /> {w.doneAt ? '做了' : '我做了'}
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1 text-sm text-slate-400"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> 第 {w.week} 週開始時出現</span>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={busy}
        className="btn-ghost btn-sm mt-3"
        onClick={async () => { if (await confirm({ title: '結束這組微練習？', message: '結束後不會再寄本週提醒，紀錄會保留。之後可以從結果頁重新開始新的一組。', confirmLabel: '結束' })) run(() => api.stopPractice()); }}
      >
        結束微練習
      </button>
    </>,
  );
}

// 試用帳號：看得到這個功能的介紹，但不能使用（見 trial/TrialLock.jsx）。
export default function PracticePanel(props) {
  const trial = useIsTrial();
  if (trial) return <TrialLock feature="practice" compact />;
  return <PracticePanelInner {...props} />;
}
