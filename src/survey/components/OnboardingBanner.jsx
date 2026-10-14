import { useState } from 'react';
import { readJSON, writeJSON } from '../utils/storage';

const STORAGE_KEY = 'aiassess_onboarded_v1';

const STEPS = {
  user: [
    { num: '1', title: '選擇評量', desc: '從首頁選取適合的評量題庫開始作答。' },
    { num: '2', title: '完成作答', desc: '依題目說明填寫，系統自動計分，可多次重測追蹤成長。' },
    { num: '3', title: '查看分析', desc: '進入「我的分析」查看構面落點、成長幅度與教練評語。' },
  ],
  coach: [
    { num: '1', title: '建立班別並邀請學員', desc: '在「班級」按「建立班別」，到「成員與設定」產生報到 QR Code 讓學員掃碼加入，或搜尋、匯入名單。' },
    { num: '2', title: '追蹤作答進度', desc: '在班級「總覽」看誰還沒完成，並複製或寄出提醒訊息。' },
    { num: '3', title: '撰寫評語', desc: '在「總覽」的成員比較表按「查看」，為每位學員寫評語與精進建議；多元評測進度在「360° 進度」分頁。' },
  ],
};

// show：呼叫端判斷「這個人還需不需要新手引導」（例如學員已完成過評測、教練已有
// 學員就不需要）——以前只看有沒有手動關掉，做過 4 次評測的人首頁仍然掛著它
// （Sprint 8 稽核：首頁在主要內容前面疊了 4 個橫幅）。
export default function OnboardingBanner({ role = 'user', show = true }) {
  const [dismissed, setDismissed] = useState(
    () => readJSON(STORAGE_KEY, {})[role] === true,
  );

  if (dismissed || !show) return null;

  const steps = STEPS[role] ?? STEPS.user;

  const dismiss = () => {
    const prev = readJSON(STORAGE_KEY, {});
    writeJSON(STORAGE_KEY, { ...prev, [role]: true });
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-brass-200 bg-brass-50 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-brass-600">
          {role === 'coach' ? '歡迎使用教練後台！以下是快速上手步驟：' : '歡迎使用全方位職能評測！以下是開始使用的步驟：'}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="關閉引導"
          className="shrink-0 text-brass-400 hover:text-brass-600"
        >
          ✕
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.num} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-white">
              {s.num}
            </span>
            <div>
              <p className="text-xs font-semibold text-brass-600">{s.title}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 text-xs font-semibold text-brass-600 hover:text-brass-700 underline"
      >
        知道了，不再顯示
      </button>
    </div>
  );
}
