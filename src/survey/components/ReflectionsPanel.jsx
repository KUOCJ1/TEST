import { useEffect, useState } from 'react';
import { NotebookPen, MessageCircle } from 'lucide-react';
import { api } from '../api/client';
import { formatDay } from '../utils/format';

// 會後反思（Sprint 40）：教練做完一對一或團隊教練後建立的待填。四題：收穫、行動、需要的支持、對這次會談的回饋。
// 內容只有這場會談的教練看得到；「把行動變成發展目標」會在「我的學習」多一個目標（預設只有自己看得到）。
const RATINGS = [1, 2, 3, 4, 5];

function ReflectionForm({ session, onSaved }) {
  const r = session.reflection;
  const [v, setV] = useState({ insight: r?.insight ?? '', action: r?.action ?? '', support: r?.support ?? '', rating: r?.rating ?? 0, ratingNote: r?.ratingNote ?? '', makeGoal: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const id = (k) => `rf-${session.id}-${k}`;
  const submit = async () => {
    setBusy(true); setError('');
    try { onSaved(await api.submitReflection(session.id, { ...v, rating: Number(v.rating) })); } catch (e) { setError(e.message || '送出失敗，請稍後再試'); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3">
      <div>
        <label htmlFor={id('insight')} className="text-sm font-semibold text-slate-700">1. 這次最大的收穫或覺察是什麼？</label>
        <textarea id={id('insight')} className="input mt-1" rows={3} maxLength={1000} value={v.insight} onChange={set('insight')} />
      </div>
      <div>
        <label htmlFor={id('action')} className="text-sm font-semibold text-slate-700">2. 接下來你要做的一個行動？</label>
        <textarea id={id('action')} className="input mt-1" rows={2} maxLength={1000} value={v.action} onChange={set('action')} placeholder="越具體越好：什麼時候、跟誰、做什麼" />
        {!r?.goalId && (
          <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={v.makeGoal} onChange={(e) => setV((cur) => ({ ...cur, makeGoal: e.target.checked }))} /> 把這個行動變成我的發展目標（會出現在「我的學習」，只有你看得到）
          </label>
        )}
      </div>
      <div>
        <label htmlFor={id('support')} className="text-sm font-semibold text-slate-700">3. 你需要什麼支持？（選填）</label>
        <textarea id={id('support')} className="input mt-1" rows={2} maxLength={1000} value={v.support} onChange={set('support')} />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">4. 這次會談對你有幫助嗎？（1 沒什麼幫助 … 5 非常有幫助）</legend>
        <div className="mt-1.5 flex gap-2">
          {RATINGS.map((n) => (
            <label key={n} className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border text-base font-semibold ${Number(v.rating) === n ? 'border-ink-700 bg-ink-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
              <input type="radio" className="sr-only" name={id('rating')} value={n} checked={Number(v.rating) === n} onChange={set('rating')} />{n}
            </label>
          ))}
        </div>
        <label htmlFor={id('note')} className="sr-only">對會談的一句話回饋</label>
        <input id={id('note')} className="input mt-2" maxLength={300} value={v.ratingNote} onChange={set('ratingNote')} placeholder="一句話回饋（選填）" />
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="button" className="btn-primary" disabled={busy || !v.insight.trim() || !v.action.trim() || !v.rating} onClick={submit}>
        {busy ? '送出中…' : r ? '更新反思' : '送出反思'}
      </button>
    </div>
  );
}

export default function ReflectionsPanel() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    let alive = true;
    api.myReflections().then((s) => alive && setList(s)).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, []);
  if (!list || list.length === 0) return null;
  const pending = list.filter((s) => !s.reflection);
  const save = (s) => { setList((cur) => cur.map((x) => (x.id === s.id ? s : x))); setEditing(null); };

  return (
    <section aria-label="會後反思" className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 flex items-center gap-1.5 text-base font-bold text-slate-700"><NotebookPen className="h-4 w-4 text-brass-500" aria-hidden="true" /> 會後反思{pending.length > 0 ? `（待填 ${pending.length}）` : ''}</h3>
      <p className="mb-4 text-sm text-slate-500">一對一或團隊教練之後的回顧。內容只有這場會談的教練看得到。</p>
      <ul className="space-y-4">
        {list.map((s) => {
          const open = !s.reflection || editing === s.id;
          return (
            <li key={s.id} className={`rounded-xl px-4 py-4 ring-1 ${s.reflection ? 'bg-slate-50 ring-slate-100' : 'bg-brass-50 ring-brass-200'}`}>
              <p className="text-xs font-semibold text-brass-600">{s.typeLabel}・{formatDay(s.sessionDate)}・{s.coachName}{s.reflection ? '' : `・請在 ${formatDay(s.dueAt)} 前填寫`}{s.overdue ? '（已逾期，仍可繳交）' : ''}</p>
              <h4 className="font-serif text-lg font-bold text-slate-900">{s.title}</h4>
              {s.focus && <p className="mt-1 text-sm text-slate-600">本次焦點：{s.focus}</p>}
              {s.coachComment && (
                <div className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100">
                  <p className="text-xs font-semibold text-slate-500">教練之前給你的評語</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{s.coachComment.text}</p>
                  {s.coachComment.tips?.length > 0 && <ul className="mt-1 list-disc pl-5">{s.coachComment.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
                </div>
              )}
              {open ? (
                <ReflectionForm session={s} onSaved={save} />
              ) : (
                <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <p><strong>收穫：</strong>{s.reflection.insight}</p>
                  <p><strong>行動：</strong>{s.reflection.action}{s.reflection.goalId ? '（已設成發展目標）' : ''}</p>
                  <p className="text-xs text-slate-500">已於 {formatDay(s.reflection.updatedAt ?? s.reflection.submittedAt)} 繳交{s.reflection.late ? '（逾期）' : ''}</p>
                  {s.reflection.coachReply && (
                    <p className="mt-2 flex gap-1.5 rounded-lg bg-white px-3 py-2 ring-1 ring-ink-700/15"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-700" aria-hidden="true" /><span><strong>{s.reflection.coachReply.by ?? '教練'}：</strong>{s.reflection.coachReply.text}</span></p>
                  )}
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(s.id)}>修改</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
