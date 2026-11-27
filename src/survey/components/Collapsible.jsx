import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// 可展開的報告區塊：報告細節預設收起，讓第一次看的人先看到重點（走查：結果頁與我的分析頁都超過一萬像素）。
// - 章節導覽連到 #id 時自動展開。
// - 列印時一律展開（print:block），不會漏印。
// variant='plain'：只有一列標題按鈕、沒有外框（內容本身已是卡片時用，避免卡片套卡片）。
export default function Collapsible({ id, title, summary = null, defaultOpen = false, variant = 'card', children }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!id) return undefined;
    const openIfTarget = () => { if (window.location.hash === `#${id}`) setOpen(true); };
    openIfTarget();
    // 已經在 #id 時再點同一個章節連結不會觸發 hashchange（讀者收合後再點就打不開），所以也聽連結的點擊。
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (a && a.getAttribute('href') === `#${id}`) setOpen(true);
    };
    window.addEventListener('hashchange', openIfTarget);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', openIfTarget);
      document.removeEventListener('click', onClick);
    };
  }, [id]);
  // 同一頁可能同時有兩份報告（例如我的分析＋歷次作答視窗）：內容區的 id 用唯一值，避免 aria-controls 指到別份。
  const uid = useId();
  const bodyId = `${id ?? 'collapsible'}-body-${uid.replace(/:/g, '')}`;
  return (
    <section id={id} className={`scroll-mt-14 ${variant === 'plain' ? '' : 'mt-4 rounded-xl bg-white ring-1 ring-slate-200'}`}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className={`tap flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 print:hidden ${variant === 'plain' ? 'bg-white ring-1 ring-slate-200' : ''}`}
        >
          <span className="min-w-0">
            <span className="block font-semibold text-slate-700">{title}</span>
            {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <span className="hidden px-4 pt-3 font-semibold text-slate-700 print:block">{title}</span>
      </h3>
      <div id={bodyId} className={`${variant === 'plain' ? 'mt-2' : 'px-4 pb-4'} ${open ? '' : 'hidden print:block'}`}>{children}</div>
    </section>
  );
}
