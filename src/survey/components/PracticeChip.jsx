import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { api } from '../api/client';
import { practiceDueThisWeek, PRACTICE_WEEKS } from '../utils/practice.js';

// 首頁：本週微練習還沒勾時才出現（Sprint 38），點了到「我的學習」。
export default function PracticeChip({ onClick }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    let alive = true;
    api.myPractice().then((x) => alive && setP(x)).catch(() => {});
    return () => { alive = false; };
  }, []);
  const due = practiceDueThisWeek(p);
  if (!due) return null;
  return (
    <button type="button" onClick={onClick} className="flex h-full w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-left shadow-sm ring-1 ring-brass-200 transition-colors hover:bg-brass-50">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarCheck className="h-4 w-4 shrink-0 text-brass-500" aria-hidden="true" />
        <span className="truncate">本週微練習（{p.currentWeek}／{PRACTICE_WEEKS}）：{due.task}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-brass-600">去勾選 →</span>
    </button>
  );
}
