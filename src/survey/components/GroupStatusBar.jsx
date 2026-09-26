import { Users2 } from 'lucide-react';
import PhaseBadge from './PhaseBadge';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * 首頁的班級狀態條：班名、教練、目前階段、（若設定了結束日期）距離評測結束的
 * 倒數。這個平台的資料模型裡「課前／課後」不是各自獨立的日期區間——同一個
 * in_progress 期間內，學員做完課前後隨時可以再做課後（見 CLAUDE.md「班級管理」
 * 一節），沒有另外的「課後開放日」，所以這裡只顯示班級整體 in_progress 窗口的
 * 結束倒數，不是「課後倒數」。
 */
export default function GroupStatusBar({ group }) {
  if (!group) return null;
  const remaining = group.phase === 'in_progress' ? daysUntil(group.endDate) : null;

  return (
    <div className="flex h-full flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-paper-100 px-4 py-2.5 text-sm ring-1 ring-paper-300">
      <span className="flex items-center gap-1.5 font-semibold text-ink-700">
        <Users2 className="h-4 w-4 text-brass-500" /> {group.name}
      </span>
      {group.coachName && <span className="text-slate-500">教練：{group.coachName}</span>}
      <PhaseBadge phase={group.phase} />
      {remaining !== null && remaining >= 0 && (
        <span className="text-xs text-slate-400">
          {remaining === 0 ? '評測今天截止' : `還有 ${remaining} 天截止`}
        </span>
      )}
    </div>
  );
}
