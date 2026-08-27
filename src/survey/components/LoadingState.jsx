import { Loader2 } from 'lucide-react';

/**
 * 全站共用的載入狀態，取代各處各自寫的純文字「載入中…」——沒有視覺動態、也沒有
 * aria-busy，螢幕閱讀器與低視力使用者都不容易察覺頁面正在載入。
 */
export default function LoadingState({ fullScreen = false, label = '載入中…' }) {
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
