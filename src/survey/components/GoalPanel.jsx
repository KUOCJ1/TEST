import { useEffect, useState } from 'react';
import { Target, Plus, X } from 'lucide-react';
import { api } from '../api/client';
import { dimTextStyle } from '../utils/color';
import GoalItem from './GoalItem';
import { startersFor } from '../data/goal-starters';

const MAX_ACTIONS = 5;

/**
 * 個人發展目標：讓學員針對弱項構面訂下目標與具體行動，下次回來可以打勾。
 * 把「看到自己哪裡弱」接到「實際做了什麼」，是歷程追蹤的最後一哩。
 * 目標只有本人看得到（教練與管理者都讀不到），所以可以誠實記錄。
 *
 * profileMode（如 DISC）：構面沒有優劣之分，不能像一般題庫那樣預設「針對最
 * 待強化的構面」——那會暗示分數最低的風格是缺點。改成中性引導語，並讓使用者
 * 自己從 dimensions 挑一個想刻意練習的風格（可以不選）。
 */
// 預計檢視日 <input type="date"> 要的是 YYYY-MM-DD；預設抓「今天 + 28 天」
// （跟後端沒帶 reviewDate 時的預設一致，見 server/src/routes/goals.js）。
function defaultReviewDateInput() {
  const d = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function GoalPanel({ assessmentId, weakestDimension, profileMode = false, dimensions = [] }) {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftActions, setDraftActions] = useState(['']);
  const [draftDimId, setDraftDimId] = useState('');
  const [draftReviewDate, setDraftReviewDate] = useState(defaultReviewDateInput);
  const [saving, setSaving] = useState(false);

  const selectedDim = profileMode ? dimensions.find((d) => d.id === draftDimId) ?? null : weakestDimension;

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
    setDraftDimId('');
    setDraftReviewDate(defaultReviewDateInput());
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!draftText.trim()) { setError('請輸入目標內容'); return; }
    setSaving(true);
    setError('');
    try {
      const goal = await api.createGoal({
        assessmentId,
        dimensionId: selectedDim?.id ?? null,
        dimensionName: selectedDim?.subtitle ?? null,
        text: draftText,
        actions: draftActions.filter((t) => t.trim()).map((text) => ({ text })),
        // 記下設定當下該構面的平均分，之後複測完可以顯示「設定時 → 最新」的變化
        // （見下方渲染，比對 dimensions prop 裡同一個構面的最新 average）。
        baselineAverage: selectedDim?.average ?? null,
        reviewDate: draftReviewDate ? new Date(`${draftReviewDate}T00:00:00`).toISOString() : undefined,
      });
      setGoals((prev) => [goal, ...(prev ?? [])]);
      resetDraft();
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // 起手行動範例：點一下放進行動清單（不超過上限、不重複），仍可自己修改。
  const starters = startersFor(assessmentId, selectedDim?.id);
  const addStarter = (text) => setDraftActions((prev) => {
    if (prev.includes(text)) return prev;
    const emptyIdx = prev.findIndex((t) => !t.trim());
    if (emptyIdx >= 0) return prev.map((t, i) => (i === emptyIdx ? text : t));
    return prev.length >= MAX_ACTIONS ? prev : [...prev, text];
  });

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
        預設只有你看得到，可以誠實記錄；個別目標也可以選擇分享給教練（分享後才看得到，追蹤筆記永遠只有你看得到）。
      </p>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {creating && (
        <div className="mb-4 rounded-xl bg-slate-50 p-4">
          {profileMode ? (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="goal-dim-select">
                想刻意練習哪一種風格？（可不選）
              </label>
              <select
                id="goal-dim-select"
                value={draftDimId}
                onChange={(e) => setDraftDimId(e.target.value)}
                className="input"
              >
                <option value="">不指定特定風格</option>
                {dimensions.map((d) => (
                  <option key={d.id} value={d.id}>{d.subtitle}</option>
                ))}
              </select>
            </div>
          ) : (
            weakestDimension && (
              <p className="mb-2 text-xs text-slate-500">
                針對目前最待強化的
                <span className="mx-1 font-semibold dim-text" style={dimTextStyle(weakestDimension.color)}>
                  {weakestDimension.subtitle}
                </span>
                訂一個目標：
              </p>
            )
          )}
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="例如：每週用 AI 完成一份市場分析，並請主管給回饋"
            rows={2}
            className="input"
          />
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-500">起手行動範例（點一下加入，可再修改）</p>
            <div className="flex flex-wrap gap-1.5">
              {starters.map((t) => (
                <button key={t} type="button" onClick={() => addStarter(t)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-left text-xs text-slate-600 hover:border-brass-400 hover:text-brass-600">
                  ＋ {t}
                </button>
              ))}
            </div>
          </div>
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
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="goal-review-date">
              預計檢視日（到期後會在首頁提醒你回來複測）
            </label>
            <input
              id="goal-review-date"
              type="date"
              value={draftReviewDate}
              onChange={(e) => setDraftReviewDate(e.target.value)}
              className="input"
            />
          </div>
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
        {goals.map((goal) => (
          <GoalItem
            key={goal.id}
            goal={goal}
            dimensions={dimensions}
            onChange={(updated) => setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))}
            onDelete={(removed) => setGoals((prev) => prev.filter((g) => g.id !== removed.id))}
          />
        ))}
      </ul>
    </section>
  );
}
