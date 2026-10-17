import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { POLICY_META } from './policy';

/**
 * 既有用戶的「請閱讀並同意」畫面（Sprint 12）：沒有同意紀錄、或政策升版後，登入後先看到這一頁，
 * 同意才能進系統；不同意可以登出。內容只放重點摘要與完整文件的連結（另開分頁，不離開這一頁）。
 */
export default function ConsentGate() {
  const { user, acceptPolicy, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = import.meta.env.BASE_URL;

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await acceptPolicy();
    } catch (e) {
      setError(e.message || '儲存失敗，請稍後再試');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-md bg-paper-50 p-6 shadow-card ring-1 ring-paper-300 sm:p-8">
        <img src={`${base}favicon.svg`} alt="" className="mb-4 h-12 w-12" />
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink-700">請閱讀並同意隱私權政策與服務條款</h1>
        <p className="mt-2 text-sm text-ink-100">
          {user?.name}，你好。{POLICY_META.operatorName ? `${POLICY_META.operatorName} ` : ''}更新了隱私權政策與服務條款，繼續使用前需要你確認一次。重點如下：
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-100">
          <li>我們蒐集你的姓名、Email、作答與成績、目標與學習清單，用於評測、報告與班級課程。</li>
          <li>你的成績只有你本人、所屬班級的教練與管理者看得到；他人對你的評分，你看不到評分者是誰，教練與管理者看得到。</li>
          <li>使用 AI 小幫手時，你輸入的文字與當次評測結果摘要（不含姓名與 Email）會送往第三方 AI 服務。</li>
          <li>想查詢、更正或刪除你的資料，請依政策中的方式聯絡我們。</li>
        </ul>
        <p className="mt-4 text-sm">
          <a href={`${base}privacy`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-700 underline underline-offset-2">閱讀完整隱私權政策</a>
          <span className="mx-2 text-ink-50">·</span>
          <a href={`${base}terms`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-700 underline underline-offset-2">閱讀服務條款</a>
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={accept} disabled={busy} className="btn-primary px-6 py-2.5">
            {busy ? '處理中…' : '我同意並繼續'}
          </button>
          <button type="button" onClick={logout} disabled={busy} className="btn-ghost px-4 py-2.5">不同意，登出</button>
        </div>
        <p className="mt-4 text-xs text-ink-50">按下「我同意並繼續」，代表你已閱讀並同意上述隱私權政策與服務條款。</p>
      </div>
    </main>
  );
}
