import { Loader2 } from 'lucide-react';

/**
 * 全站共用的載入狀態，取代各處各自寫的純文字「載入中…」——沒有視覺動態、也沒有
 * aria-busy，螢幕閱讀器與低視力使用者都不容易察覺頁面正在載入。
 */
export default function LoadingState({ fullScreen = false, label = '載入中…', skeleton = false }) {
  // 骨架畫面：頁面的大致輪廓（標題＋幾張卡片），內容到了再就地替換，不會整頁跳動。
  if (skeleton) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <span className="sr-only">{label}</span>
        <div className="h-7 w-40 animate-pulse rounded bg-slate-200" aria-hidden="true" />
        <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-slate-100" aria-hidden="true" />
        <div className="mt-6 space-y-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white p-5 ring-1 ring-slate-100">
              <div className="h-5 w-2/3 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
              <div className="mt-5 h-11 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-2 text-slate-400 ${fullScreen ? 'min-h-screen' : 'py-20'}`}
    >
      <Loader2 className="h-5 w-5 animate-spin text-brass-400" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
