import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// 可展開的報告區塊：報告細節預設收起，讓第一次看的人先看到重點（走查：結果頁與我的分析頁都超過一萬像素）。
// - 章節導覽連到 #id 時自動展開。
// - 列印時一律展開（print:block），不會漏印。
export default function Collapsible({ id, title, summary = null, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!id) return undefined;
    const openIfTarget = () => { if (window.location.hash === `#${id}`) setOpen(true); };
    openIfTarget();
    window.addEventListener('hashchange', openIfTarget);
    return () => window.removeEventListener('hashchange', openIfTarget);
  }, [id]);
  const bodyId = id ? `${id}-body` : undefined;
  return (
    <section id={id} className="mt-4 scroll-mt-14 rounded-xl bg-white ring-1 ring-slate-200">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="tap flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 print:hidden"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-slate-700">{title}</span>
            {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <span className="hidden px-4 pt-3 font-semibold text-slate-700 print:block">{title}</span>
      </h3>
      <div id={bodyId} className={`px-4 pb-4 ${open ? '' : 'hidden print:block'}`}>{children}</div>
    </section>
  );
}
