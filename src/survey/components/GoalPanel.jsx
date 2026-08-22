import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, Check, X } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

const MAX_ACTIONS = 5;

/**
 * 個人發展目標：讓學員針對弱項構面訂下目標與具體行動，下次回來可以打勾。
 * 把「看到自己哪裡弱」接到「實際做了什麼」，是歷程追蹤的最後一哩。
 * 目標只有本人看得到（教練與管理者都讀不到），所以可以誠實記錄。
 */
export default function GoalPanel({ assessmentId, weakestDimension }) {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftActions, setDraftActions] = useState(['']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.myGoals(assessmentId)
      .then((list) => active && setGoals(list))
      .catch(() => active && setGoals([]));
    return () => { active = false; };
  }, [assessmentId]);

  const resetDraft = () => {
    setDraftText('');
    setDraftActions(['']);
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!draftText.trim()) { setError('請輸入目標內容'); return; }
    setSaving(true);
    setError('');
    try {
      const goal = await api.createGoal({
        assessmentId,
        dimensionId: weakestDimension?.id ?? null,
        dimensionName: weakestDimension?.subtitle ?? null,
        text: draftText,
        actions: draftActions.filter((t) => t.trim()).map((text) => ({ text })),
      });
      setGoals((prev) => [goal, ...(prev ?? [])]);
      resetDraft();
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const patchGoal = async (goal, body) => {
    setError('');
    try {
      const updated = await api.updateGoal(goal.id, body);
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (e) {
      setError(e.message || '更新失敗');
    }
  };

  const toggleAction = (goal, actionId) =>
    patchGoal(goal, {
      actions: goal.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)),
    });

  const handleDelete = async (goal) => {
    if (!window.confirm('確定要刪除這個目標嗎？')) return;
    setError('');
    try {
      await api.deleteGoal(goal.id);
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch (e) {
      setError(e.message || '刪除失敗');
    }
  };

  if (goals === null) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-700">
          <Target className="h-4 w-4 text-brass-500" /> 我的發展目標
        </h3>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-secondary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 新增目標
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        只有你看得到，教練與管理者都不會讀到——可以誠實記錄。
      </p>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {creating && (
        <div className="mb-4 rounded-xl bg-slate-50 p-4">
          {weakestDimension && (
            <p className="mb-2 text-xs text-slate-500">
              針對目前最待強化的
              <span className="mx-1 font-semibold" style={{ color: weakestDimension.color }}>
                {weakestDimension.subtitle}
              </span>
              訂一個目標：
            </p>
          )}
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="例如：每週用 AI 完成一份市場分析，並請主管給回饋"
            rows={2}
            className="input"
          />
          <p className="mb-1.5 mt-3 text-xs font-semibold text-slate-500">具體行動（最多 {MAX_ACTIONS} 條）</p>
          {draftActions.map((a, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                value={a}
                onChange={(e) => setDraftActions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`行動 ${i + 1}`}
                className="input"
              />
              {draftActions.length > 1 && (
                <button
                  type="button"
                  aria-label={`移除行動 ${i + 1}`}
                  onClick={() => setDraftActions((prev) => prev.filter((_, j) => j !== i))}
                  className="btn-icon shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {draftActions.length < MAX_ACTIONS && (
            <button
              type="button"
              onClick={() => setDraftActions((prev) => [...prev, ''])}
              className="btn-ghost btn-sm"
            >
              <Plus className="h-3.5 w-3.5" /> 新增行動
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={handleCreate} disabled={saving} className="btn-primary btn-sm">
              {saving ? '儲存中…' : '儲存目標'}
            </button>
            <button type="button" onClick={resetDraft} className="btn-ghost btn-sm">取消</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !creating && (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          還沒有設定目標。看完上面的分析後，挑一個最想改變的地方訂個目標吧。
        </p>
      )}

      <ul className="space-y-3">
        {goals.map((goal) => {
          const doneCount = goal.actions.filter((a) => a.done).length;
          return (
            <li
              key={goal.id}
              className={`rounded-xl border px-4 py-3 ${
                goal.achievedAt ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {goal.dimensionName && (
                    <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                      {goal.dimensionName}
                    </span>
                  )}
                  <p className={`text-sm font-semibold ${goal.achievedAt ? 'text-emerald-800' : 'text-slate-700'}`}>
                    {goal.text}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    設定於 {formatDate(goal.createdAt)}
                    {goal.actions.length > 0 && ` · 行動 ${doneCount}/${goal.actions.length}`}
                    {goal.achievedAt && ` · 已於 ${formatDate(goal.achievedAt)} 達成`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => patchGoal(goal, { achieved: !goal.achievedAt })}
                    className={`btn-sm ${goal.achievedAt ? 'btn-ghost' : 'btn-secondary'}`}
                  >
                    {goal.achievedAt ? '取消達成' : '標記達成'}
                  </button>
                  <button
                    type="button"
                    aria-label="刪除目標"
                    onClick={() => handleDelete(goal)}
                    className="btn-icon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {goal.actions.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {goal.actions.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => toggleAction(goal, a.id)}
                        className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            a.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                          }`}
                        >
                          {a.done && <Check className="h-3 w-3" />}
                        </span>
                        <span className={`text-sm ${a.done ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                          {a.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
