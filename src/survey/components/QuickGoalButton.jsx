import { useState } from 'react';
import { Target, Check } from 'lucide-react';
import { api } from '../api/client';

/**
 * 「訂成目標」：把看到的需求（教練的精進建議、360° 落差…）一步接成發展目標，不必重打一遍。
 * 點開後文字已預填，可以先改再建立；也可帶入起手行動。建立後在「我的學習」可以繼續編輯。
 * 目標預設只有本人看得到。
 */
export default function QuickGoalButton({ assessmentId, dimension = null, text, actions = [], label = '訂成目標' }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(text);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <Check className="h-3.5 w-3.5" /> 已建立目標，到<a href={`${import.meta.env.BASE_URL}learning`} className="underline">「我的學習」</a>繼續編輯
      </span>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-brass-600">
        <Target className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }

  const create = async () => {
    if (!value.trim()) { setError('請輸入目標內容'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createGoal({
        assessmentId,
        dimensionId: dimension?.id ?? null,
        dimensionName: dimension?.name ?? null,
        text: value,
        actions: actions.map((t) => ({ text: t })),
        baselineAverage: typeof dimension?.average === 'number' ? dimension.average : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || '建立失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 w-full rounded-lg bg-slate-50 p-3 text-left">
      <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor={`qg-${text.slice(0, 12)}`}>目標內容（可以先修改）</label>
      <textarea id={`qg-${text.slice(0, 12)}`} value={value} onChange={(e) => setValue(e.target.value)} rows={2} className="input" />
      {actions.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500" aria-label="起手行動">
          {actions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={saving} onClick={create} className="btn-primary btn-sm">{saving ? '建立中…' : '建立目標'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">取消</button>
      </div>
    </div>
  );
}
