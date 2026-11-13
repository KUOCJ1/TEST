import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * 斷線提示條（手機 App 化 M5-3）：瀏覽器回報離線時，頁首下方顯示一條提示；恢復連線自動消失。
 * 作答草稿本來就存在這個瀏覽器（localStorage），所以提示文字說清楚「進度還在，連線後再送出」。
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-[var(--app-header-h,57px)] z-20 flex items-center justify-center gap-2 border-b border-slate-300 bg-slate-800 px-4 py-2 text-center text-sm text-white print:hidden"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      目前沒有網路連線。作答進度已存在這支手機，連線後再送出。
    </div>
  );
}
