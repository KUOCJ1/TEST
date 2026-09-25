import { useState } from 'react';
import { Target, Check } from 'lucide-react';
import { api } from '../api/client';

function actionTextFor(article) {
  return `閱讀：《${article.title}》 ${article.url}`;
}

/**
 * 延伸閱讀文章旁的「加入目標」：把一篇文章變成既有目標的行動項目，或順手建立
 * 一個新目標。刻意不跟 GoalPanel 共用 goals 狀態（各自獨立抓一次自己的資料）——
 * 兩者可能同時出現在同一頁（UserDashboard 的報告 + 下方目標區），也可能只有
 * 這裡出現（SurveyApp 剛送出評測、還沒有 GoalPanel 的畫面），統一走「各自抓自己
 * 的資料」比較不會為了共享一份 state 而把兩個本來獨立的元件耦合在一起。已知的
 * 取捨：透過這裡加的行動，若 GoalPanel 剛好也在畫面上，要等下次重新整理／切換
 * 分頁才會顯示最新內容。
 */
export default function AddToGoalButton({ assessmentId, dimension, article, goals, onGoalsChange }) {
  const [open, setOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const openGoals = goals.filter((g) => !g.achievedAt);
  const selectedGoal = openGoals.find((g) => g.id === selectedGoalId) ?? null;
  const selectedGoalFull = selectedGoal && selectedGoal.actions.length >= 5;

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <Check className="h-3.5 w-3.5" /> 已加入目標
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-brass-600"
      >
        <Target className="h-3.5 w-3.5" /> 加入目標
      </button>
    );
  }

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      const actionText = actionTextFor(article);
      if (selectedGoal) {
        const updated = await api.updateGoal(selectedGoal.id, {
          actions: [...selectedGoal.actions, { text: actionText }],
        });
        onGoalsChange((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      } else {
        const created = await api.createGoal({
          assessmentId,
          dimensionId: dimension?.id ?? null,
          dimensionName: dimension?.subtitle ?? null,
          text: dimension?.subtitle ? `深化「${dimension.subtitle}」` : '從延伸閱讀展開的新目標',
          actions: [{ text: actionText }],
          baselineAverage: dimension?.average ?? null,
        });
        onGoalsChange((prev) => [created, ...prev]);
      }
      setDone(true);
    } catch (e) {
      setError(e.message || '加入失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1.5 rounded-lg bg-slate-50 p-2.5">
      <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={`goal-pick-${article.url}`}>
        加到哪個目標？
      </label>
      <select
        id={`goal-pick-${article.url}`}
        value={selectedGoalId}
        onChange={(e) => setSelectedGoalId(e.target.value)}
        className="input !py-1.5 text-sm"
      >
        <option value="">+ 建立新目標</option>
        {openGoals.map((g) => (
          <option key={g.id} value={g.id} disabled={g.actions.length >= 5}>
            {g.text}{g.actions.length >= 5 ? '（行動已滿）' : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || selectedGoalFull}
          className="btn-primary btn-sm"
        >
          {saving ? '加入中…' : '確認加入'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">取消</button>
      </div>
    </div>
  );
}
