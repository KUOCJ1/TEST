import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { api } from '../api/client';

// 首頁：有待填的會後反思時才出現（Sprint 40），點了到「我的學習」。
export default function ReflectionChip({ onClick }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    api.myReflections().then((s) => alive && setN(s.filter((x) => !x.reflection).length)).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!n) return null;
  return (
    <button type="button" onClick={onClick} className="flex h-full w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-left shadow-sm ring-1 ring-brass-200 transition-colors hover:bg-brass-50">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><NotebookPen className="h-4 w-4 text-brass-500" aria-hidden="true" /> 待填會後反思 {n} 份</span>
      <span className="shrink-0 text-xs font-semibold text-brass-600">去填寫 →</span>
    </button>
  );
}
