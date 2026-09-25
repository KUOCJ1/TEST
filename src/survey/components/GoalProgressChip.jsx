import { Target } from 'lucide-react';

/**
 * 首頁的「我的目標」摘要：進行中目標數與行動完成率，點擊直接跳到「我的分析」
 * （目標區塊在該頁面）。目標橫跨多個題庫，這裡刻意不細分是哪一個評量的目標，
 * 只給一個總覽數字，引導使用者回去分析頁查看細節。
 */
export default function GoalProgressChip({ goals, onClick }) {
  const inProgress = goals.filter((g) => !g.achievedAt);
  if (inProgress.length === 0) return null;

  const totalActions = inProgress.reduce((n, g) => n + g.actions.length, 0);
  const doneActions = inProgress.reduce((n, g) => n + g.actions.filter((a) => a.done).length, 0);
  const rate = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-100 transition-colors hover:bg-slate-50"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Target className="h-4 w-4 text-brass-500" />
        我的目標：{inProgress.length} 個進行中
        {rate !== null && <span className="text-slate-400 font-normal">· 行動完成率 {rate}%</span>}
      </span>
      <span className="text-xs font-semibold text-brass-600">查看 →</span>
    </button>
  );
}
