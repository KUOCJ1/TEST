import { useState } from 'react';
import { api } from '../api/client';

export default function CommentEditor({ submission, existingComment, onSaved, onCancel }) {
  const [text, setText] = useState(existingComment?.text ?? '');
  const [tips, setTips] = useState(existingComment?.tips?.length ? existingComment.tips : ['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setTip = (i, v) => setTips((prev) => prev.map((t, j) => (j === i ? v : t)));
  const addTip = () => setTips((prev) => [...prev, '']);
  const removeTip = (i) => setTips((prev) => prev.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!text.trim()) { setError('請輸入評語內容'); return; }
    setSaving(true);
    setError('');
    try {
      const comment = await api.upsertComment(submission.id, {
        text: text.trim(),
        tips: tips.filter((t) => t.trim()),
      });
      onSaved(comment);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="mb-2 text-sm font-semibold text-brand-700">
        {existingComment ? '編輯評語' : '新增評語'}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="針對此學員的整體觀察與評語…"
        className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      <p className="mt-3 mb-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wide">精進建議（最多 5 條）</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 text-xs font-bold text-brand-400">{i + 1}.</span>
            <input
              type="text"
              value={tip}
              onChange={(e) => setTip(i, e.target.value)}
              placeholder={`建議 ${i + 1}`}
              className="flex-1 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            {tips.length > 1 && (
              <button type="button" onClick={() => removeTip(i)} className="text-slate-400 hover:text-red-500">✕</button>
            )}
          </div>
        ))}
        {tips.length < 5 && (
          <button type="button" onClick={addTip} className="text-xs font-semibold text-brand-600 hover:text-brand-800">
            + 新增建議
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? '儲存中…' : '儲存評語'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          取消
        </button>
      </div>
    </div>
  );
}
