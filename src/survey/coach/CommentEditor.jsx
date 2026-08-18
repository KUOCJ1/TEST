import { useEffect, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { api } from '../api/client';
import { readJSON, writeJSON } from '../utils/storage';

const draftKey = (id) => `aiassess_comment_draft_${id}_v1`;

export default function CommentEditor({ submission, existingComment, onSaved, onCancel }) {
  const [text, setText] = useState(() => {
    if (existingComment?.text) return existingComment.text;
    return readJSON(draftKey(submission.id), {}).text ?? '';
  });
  const [tips, setTips] = useState(() => {
    if (existingComment?.tips?.length) return existingComment.tips;
    const d = readJSON(draftKey(submission.id), {});
    return d.tips?.length ? d.tips : [''];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef(null);
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeJSON(draftKey(submission.id), { text, tips });
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [text, tips, submission.id]);

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
      try { localStorage.removeItem(draftKey(submission.id)); } catch { /* ignore */ }
      onSaved(comment);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-brass-200 bg-brass-50 p-4">
      <p className="mb-2 text-sm font-semibold text-brass-600">
        {existingComment ? '編輯評語' : '新增評語'}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="針對此學員的整體觀察與評語…"
        className="input"
      />

      <p className="mt-3 mb-1.5 text-xs font-semibold text-brass-600 uppercase tracking-wide">精進建議（最多 5 條）</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 text-xs font-bold text-brass-400">{i + 1}.</span>
            <input
              type="text"
              value={tip}
              onChange={(e) => setTip(i, e.target.value)}
              placeholder={`建議 ${i + 1}`}
              className="input flex-1"
            />
            {tips.length > 1 && (
              <button type="button" onClick={() => removeTip(i)} aria-label="移除此建議" className="btn-icon">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {tips.length < 5 && (
          <button type="button" onClick={addTip} className="inline-flex items-center gap-1 text-xs font-semibold text-brass-600 hover:text-brass-700">
            <Plus className="h-3.5 w-3.5" /> 新增建議
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary btn-sm"
        >
          {saving ? '儲存中…' : '儲存評語'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          取消
        </button>
      </div>
    </div>
  );
}
