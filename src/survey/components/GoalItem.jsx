import { useState } from 'react';
import { Check, Trash2, CalendarClock, Share2, MessageSquarePlus } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../utils/format';
import { useConfirm } from './useConfirm';

const URL_RE = /(https?:\/\/[^\s]+)/g;
// 行動文字裡常帶著文章連結：把網址變成可點的連結（split 搭配單一 capture group：奇數索引是網址）。
function linkifyText(text) {
  return text.split(URL_RE).map((part, i) => (i % 2 === 1
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:text-brass-600" onClick={(e) => e.stopPropagation()}>{part}</a>
    : <span key={i}>{part}</span>));
}

const RATINGS = [
  [1, '幾乎沒做'], [2, '做了一點'], [3, '做了一半'], [4, '大多有做'], [5, '都有做到'],
];
const ratingLabel = (n) => RATINGS.find(([v]) => v === n)?.[1] ?? '';
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

/** 設定時 → 最新的平均分變化；進步夠明顯時順便問「要不要標記達成」。 */
function BaselineDelta({ goal, dimensions }) {
  if (!dimensions || !goal.dimensionId || goal.baselineAverage == null) return null;
  const current = dimensions.find((d) => d.id === goal.dimensionId);
  if (!current || typeof current.average !== 'number') return null;
  const delta = current.average - goal.baselineAverage;
  return (
    <p className="mt-1 text-xs text-slate-500">
      設定目標時「{current.subtitle}」平均 {goal.baselineAverage.toFixed(1)} 分 → 最新 {current.average.toFixed(1)} 分
      {!goal.achievedAt && delta >= 0.3 && <span className="ml-1 font-semibold text-emerald-600">（已提升 {delta.toFixed(1)}，可以考慮標記達成）</span>}
    </p>
  );
}

/**
 * 一個發展目標的完整操作：勾行動、標達成、改檢視日／延後、選擇分享給教練、追蹤紀錄、刪除。
 * 「我的分析」的目標區與「我的學習」共用這個元件。
 * 目標預設只有本人看得到；分享是「單一目標」的選擇，而且追蹤筆記永遠只有自己看得到。
 *
 * @param {{goal, onChange:(g)=>void, onDelete?:(g)=>void, dimensions?:Array}} props
 */
export default function GoalItem({ goal, onChange, onDelete, dimensions }) {
  const confirm = useConfirm();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(toDateInput(goal.reviewDate));

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      onChange(updated);
      return true;
    } catch (e) {
      setError(e.message || '操作失敗，請稍後再試');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doneCount = goal.actions.filter((a) => a.done).length;
  const checkins = [...(goal.checkins ?? [])].reverse();
  const shown = showAll ? checkins : checkins.slice(0, 3);

  const toggleAction = (id) => run(() => api.updateGoal(goal.id, { actions: goal.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) }));
  const saveDate = async () => {
    if (!dateValue) return;
    if (await run(() => api.updateGoal(goal.id, { reviewDate: new Date(`${dateValue}T00:00:00`).toISOString() }))) setEditingDate(false);
  };
  const submitCheckin = async () => {
    if (!note.trim() && !rating) { setError('寫一句話，或選一個這段時間的進行程度'); return; }
    const ok = await run(() => api.addGoalCheckin(goal.id, { text: note.trim(), ...(rating ? { rating } : {}) }));
    if (ok) { setNote(''); setRating(0); setShowCheckin(false); }
  };
  const handleDelete = async () => {
    if (!(await confirm('確定要刪除這個目標嗎？追蹤紀錄也會一併刪除。'))) return;
    setBusy(true);
    try { await api.deleteGoal(goal.id); onDelete?.(goal); } catch (e) { setError(e.message || '刪除失敗'); } finally { setBusy(false); }
  };

  return (
    <li className={`rounded-xl border px-4 py-3 ${goal.achievedAt ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {goal.dimensionName && (
            <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{goal.dimensionName}</span>
          )}
          <p className={`text-sm font-semibold ${goal.achievedAt ? 'text-emerald-800' : 'text-slate-700'}`}>{goal.text}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            設定於 {formatDate(goal.createdAt)}
            {goal.actions.length > 0 && ` · 行動 ${doneCount}/${goal.actions.length}`}
            {goal.achievedAt && ` · 已於 ${formatDate(goal.achievedAt)} 達成`}
            {!goal.achievedAt && goal.reviewDate && ` · 預計 ${formatDate(goal.reviewDate)} 檢視`}
          </p>
          <BaselineDelta goal={goal} dimensions={dimensions} />
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" disabled={busy} onClick={() => run(() => api.updateGoal(goal.id, { achieved: !goal.achievedAt }))}
            className={`btn-sm ${goal.achievedAt ? 'btn-ghost' : 'btn-secondary'}`}>
            {goal.achievedAt ? '取消達成' : '標記達成'}
          </button>
          <button type="button" aria-label="刪除目標" disabled={busy} onClick={handleDelete} className="btn-icon">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {goal.actions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {goal.actions.map((a) => (
            <li key={a.id}>
              <button type="button" disabled={busy} onClick={() => toggleAction(a.id)} className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50">
                <span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${a.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                  {a.done && <Check className="h-3 w-3" />}
                </span>
                <span className="sr-only">{a.done ? '已完成：' : '未完成：'}</span>
                <span className={`text-sm ${a.done ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{linkifyText(a.text)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 檢視日與延後（已達成的目標不需要） */}
      {!goal.achievedAt && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {editingDate ? (
            <>
              <label className="sr-only" htmlFor={`rd-${goal.id}`}>預計檢視日</label>
              <input id={`rd-${goal.id}`} type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="input w-40 py-1" />
              <button type="button" disabled={busy} onClick={saveDate} className="btn-primary btn-sm">儲存日期</button>
              <button type="button" onClick={() => { setEditingDate(false); setDateValue(toDateInput(goal.reviewDate)); }} className="btn-ghost btn-sm">取消</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditingDate(true)} className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-brass-600">
                <CalendarClock className="h-3.5 w-3.5" /> 修改檢視日
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => api.snoozeGoal(goal.id, 7))} className="font-semibold text-slate-500 hover:text-brass-600">
                延後一週
              </button>
            </>
          )}
        </div>
      )}

      {/* 追蹤紀錄 */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">追蹤紀錄（{checkins.length}）</p>
          {!showCheckin && (
            <button type="button" onClick={() => setShowCheckin(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brass-600 hover:underline">
              <MessageSquarePlus className="h-3.5 w-3.5" /> 記錄這段時間的進度
            </button>
          )}
        </div>
        {showCheckin && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor={`ci-${goal.id}`}>這段時間發生了什麼？（一句話就好）</label>
            <textarea id={`ci-${goal.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="input" placeholder="例如：試了一次，同事說我的說明比之前清楚" />
            <p className="mb-1 mt-2 text-xs font-semibold text-slate-500">這段時間，這個目標做了多少？</p>
            <div role="radiogroup" aria-label="進行程度" className="flex flex-wrap gap-1.5">
              {RATINGS.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={rating === v} onClick={() => setRating(v)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${rating === v ? 'border-brass-500 bg-brass-50 font-semibold text-brass-600' : 'border-slate-200 bg-white text-slate-600'}`}>
                  {v} {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={submitCheckin} className="btn-primary btn-sm">儲存紀錄</button>
              <button type="button" onClick={() => { setShowCheckin(false); setNote(''); setRating(0); }} className="btn-ghost btn-sm">取消</button>
            </div>
          </div>
        )}
        {shown.length > 0 && (
          <ol className="mt-2 space-y-1.5" aria-label="追蹤紀錄">
            {shown.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-slate-600">
                  <span className="mr-2 text-xs text-slate-400">{formatDate(c.at)}</span>
                  {c.rating && <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{c.rating}／5 {ratingLabel(c.rating)}</span>}
                  {c.text}
                </span>
                <button type="button" aria-label="刪除這筆紀錄" disabled={busy} onClick={() => run(() => api.removeGoalCheckin(goal.id, c.id))} className="shrink-0 text-xs text-slate-300 hover:text-red-500">刪除</button>
              </li>
            ))}
          </ol>
        )}
        {checkins.length > 3 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-semibold text-slate-400 hover:text-slate-600">
            {showAll ? '只看最近 3 筆' : `顯示全部 ${checkins.length} 筆`}
          </button>
        )}
      </div>

      {/* 分享給教練：預設關閉 */}
      <label className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <input type="checkbox" checked={goal.sharedWithCoach} disabled={busy}
          onChange={(e) => run(() => api.updateGoal(goal.id, { sharedWithCoach: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ink-700" />
        <span>
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600"><Share2 className="h-3.5 w-3.5" /> 分享給我的教練</span>
          <span className="block">
            {goal.sharedWithCoach
              ? '教練現在看得到這個目標、行動與進度；你的追蹤筆記仍然只有你看得到。隨時可以取消。'
              : '目前只有你看得到。分享後，教練可以看到目標、行動與進度（不含追蹤筆記），方便給你支持。'}
          </span>
        </span>
      </label>

      {error && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
