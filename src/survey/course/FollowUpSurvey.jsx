import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../api/client';
import { FOLLOW_UP } from '../data/course-follow-up.js';

// 課後問卷的 30／60 天追蹤問卷。驗證在伺服器（server/src/lib/courseFollowUp.js），這裡只收答案與送出。
export default function FollowUpSurvey({ stage, onClose, onDone }) {
  const spec = FOLLOW_UP[stage];
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!spec) return null;

  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggle = (id, opt) => setAnswers((a) => {
    const cur = a[id] ?? [];
    return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
  });
  const missing = spec.questions.filter((q) => q.required && !answers[q.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (missing.length > 0) { setError(`還有 ${missing.length} 題必填沒有回答`); return; }
    setBusy(true); setError('');
    try {
      await api.submitFollowUp(stage, answers);
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err.message || '送出失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <section aria-label={`${spec.title}問卷`} className="mx-auto mb-6 max-w-2xl rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 sm:p-6">
      {children}
    </section>
  );

  if (done) {
    return shell(
      <div className="text-center">
        <Check className="mx-auto mb-2 h-8 w-8 text-emerald-600" aria-hidden="true" />
        <h2 className="text-lg font-extrabold text-slate-800">謝謝您的回覆</h2>
        <p className="mt-1 text-sm text-slate-500">
          {stage === 60
            ? '想看看自己的變化，可以回到平台首頁重做一次課前的 AI 職能評測。'
            : '60 天後我們會再邀請您回顧一次。'}
        </p>
        <button type="button" onClick={onClose} className="btn-primary mt-4">完成</button>
      </div>,
    );
  }

  return shell(
    <form onSubmit={submit} noValidate>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-lg font-extrabold text-slate-800">AI 深度整合工作坊｜{spec.title}</h2>
        <button type="button" onClick={onClose} aria-label="關閉" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <p className="mb-1 text-sm text-slate-500">{spec.intro}約 {spec.minutes} 分鐘。</p>
      <p className="mb-4 text-xs text-slate-400">承辦單位只會看到完成人數與比例，看不到您的個別答案。</p>

      <div className="space-y-4">
        {spec.questions.map((q) => (
          <fieldset key={q.id} data-key={q.id} className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-700">{q.text}{q.required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}</legend>
            {q.type === 'text' ? (
              <textarea
                aria-label={q.text} rows={3} maxLength={q.max} value={answers[q.id] ?? ''}
                onChange={(e) => set(q.id, e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const checked = q.type === 'multi' ? (answers[q.id] ?? []).includes(o.id) : answers[q.id] === o.id;
                  return (
                    <label key={o.id} className={`flex min-h-[2.75rem] cursor-pointer items-center rounded-lg border px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-brass-400 ${checked ? 'border-ink-700 bg-ink-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brass-400'}`}>
                      <input
                        type={q.type === 'multi' ? 'checkbox' : 'radio'} className="sr-only" name={q.id} value={o.id} checked={checked}
                        onChange={() => (q.type === 'multi' ? toggle(q.id, o.id) : set(q.id, o.id))}
                      />
                      {o.text}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">稍後再填</button>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? '送出中…' : '送出'}</button>
      </div>
    </form>,
  );
}
