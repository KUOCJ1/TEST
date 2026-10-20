import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { goalReminders } from '../utils/goalReminders';

/**
 * 站內的目標提醒（不靠寄信，登入就看得到）：逾期了就回來複測或延後；時間過一半沒記錄進度就去記一筆。
 * 一次最多顯示 2 則，避免一進首頁就被提醒淹沒；「稍後」只在這次瀏覽有效。
 */
export default function GoalReminders({ goals, onGoalChanged, skipOverdue = false }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => new Set());
  const [error, setError] = useState('');
  const items = goalReminders(goals)
    .filter((r) => !dismissed.has(r.goal.id) && !(skipOverdue && r.kind === 'overdue'))
    .slice(0, 2);
  if (items.length === 0) return null;

  const snooze = async (goal) => {
    setError('');
    try { onGoalChanged(await api.snoozeGoal(goal.id, 7)); } catch (e) { setError(e.message || '延後失敗'); }
  };
  const dismiss = (id) => setDismissed((prev) => new Set(prev).add(id));

  return (
    <section aria-label="目標提醒" className="mb-6 space-y-3">
      {items.map(({ goal, kind }) => (
        <div key={goal.id} className="rounded-2xl border border-brass-200 bg-brass-50 px-5 py-4">
          <p className="flex items-start gap-2 font-semibold text-slate-800">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" aria-hidden="true" />
            <span>
              {kind === 'overdue'
                ? `「${goal.text}」已經到了預計檢視的日子`
                : `「${goal.text}」的時間已經過一半了`}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {kind === 'overdue'
              ? '回來做一次複測，看看這段時間有沒有變化；如果還沒準備好，可以延後一週。'
              : '花一分鐘記錄一下這段時間的進度，事後比較容易看出哪些做法有效。'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {kind === 'overdue' ? (
              <>
                <button type="button" onClick={() => navigate(`/survey/${goal.assessmentId}`)} className="btn-primary btn-sm">回來複測</button>
                <button type="button" onClick={() => snooze(goal)} className="btn-secondary btn-sm">延後一週</button>
                <button type="button" onClick={() => navigate('/learning')} className="btn-ghost btn-sm">去看這個目標</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/learning')} className="btn-primary btn-sm">記錄進度</button>
                <button type="button" onClick={() => dismiss(goal.id)} className="btn-ghost btn-sm">稍後</button>
              </>
            )}
          </div>
        </div>
      ))}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
