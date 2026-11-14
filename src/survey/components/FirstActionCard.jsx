import { useEffect, useMemo, useState } from 'react';
import { Footprints, Check } from 'lucide-react';
import { api } from '../api/client';
import { startersFor } from '../data/goal-starters.js';
import { dimLabel } from '../utils/dimensionLabel';

// 結果頁的「選一件事」（Sprint 25）：看完報告離開之前，先留下一個具體的第一步。
// 沒有進行中的目標：從最弱構面的起手行動挑一個，一鍵建立發展目標（預設只有本人看得到）。
// 已有進行中的目標：改成一鍵回報進度（做了／做了一部分／還沒），可選填一句話。
const PROGRESS = [
  { rating: 5, label: '做了' },
  { rating: 3, label: '做了一部分' },
  { rating: 1, label: '還沒開始' },
];

function pickFocusDimension(dimensions = []) {
  const scored = dimensions.filter((d) => typeof d.average === 'number' && d.average > 0);
  if (!scored.length) return null;
  return [...scored].sort((a, b) => a.average - b.average)[0];
}

export default function FirstActionCard({ result }) {
  const dim = useMemo(() => pickFocusDimension(result.dimensions), [result.dimensions]);
  const [goals, setGoals] = useState(null);
  const [picked, setPicked] = useState(0);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.myGoals(result.assessmentId).then((g) => active && setGoals(g)).catch(() => active && setGoals([]));
    return () => { active = false; };
  }, [result.assessmentId]);

  if (!dim || goals === null) return null;
  const active = goals.find((g) => !g.achievedAt);
  const starters = startersFor(result.assessmentId, dim.id).slice(0, 3);

  const create = async () => {
    setBusy(true); setError('');
    try {
      const g = await api.createGoal({
        assessmentId: result.assessmentId,
        dimensionId: dim.id,
        dimensionName: dim.name,
        text: `把「${dimLabel(dim)}」往前推一步`,
        actions: [{ text: starters[picked] }],
        baselineAverage: dim.average,
      });
      // 預設只有本人看得到；勾選才分享給教練（教練只看得到目標本身，看不到追蹤筆記）。
      let saved = g;
      if (share) saved = await api.updateGoal(g.id, { sharedWithCoach: true }).catch(() => g);
      setGoals([saved, ...goals]);
      setMsg('已記下你的第一步。幾天後我們會輕輕提醒你回來回報。');
    } catch (e) { setError(e.message || '建立失敗，請稍後再試'); } finally { setBusy(false); }
  };

  const report = async (rating) => {
    setBusy(true); setError('');
    try {
      const g = await api.addGoalCheckin(active.id, { rating, text: note });
      setGoals(goals.map((x) => (x.id === g.id ? g : x)));
      setNote('');
      setMsg('已回報，謝謝你。');
    } catch (e) { setError(e.message || '回報失敗，請稍後再試'); } finally { setBusy(false); }
  };

  return (
    <section aria-label="選一件事" className="mx-5 mt-5 rounded-2xl border border-brass-200 bg-brass-50 px-4 py-4 print:hidden sm:mx-7">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-800"><Footprints className="h-4 w-4 text-ink-700" /> {active ? '回報一下進度' : '先選一件事開始'}</h3>
      {msg ? (
        <p role="status" className="mt-2 flex items-center gap-1 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" /> {msg}</p>
      ) : active ? (
        <>
          <p className="mt-1 text-sm text-slate-600">目標：{active.text}{active.actions?.[0]?.text ? `（${active.actions[0].text}）` : ''}。這段時間做得怎麼樣？</p>
          <label className="sr-only" htmlFor="fa-note">心得（選填）</label>
          <input id="fa-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="一句話心得（選填）" className="input mt-2" />
          <div className="mt-2 flex flex-wrap gap-2">
            {PROGRESS.map((p) => (
              <button key={p.rating} type="button" disabled={busy} onClick={() => report(p.rating)} className="btn-secondary btn-sm">{p.label}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">你目前最有成長空間的是「{dimLabel(dim)}」。挑一件這兩週內做得到的事：</p>
          <fieldset className="mt-2 space-y-2">
            <legend className="sr-only">起手行動</legend>
            {starters.map((s, i) => (
              <label key={s} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100">
                <input type="radio" name="first-action" checked={picked === i} onChange={() => setPicked(i)} className="mt-1" />
                <span>{s}</span>
              </label>
            ))}
          </fieldset>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1" />
            <span>讓我的教練看到這個目標<span className="block text-xs text-slate-500">教練只會看到目標與起手行動，看不到你的追蹤筆記；沒勾選就只有你自己看得到，之後可以在「我的學習」改。</span></span>
          </label>
          <button type="button" disabled={busy} onClick={create} className="btn-primary mt-3">就做這件事</button>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
