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
    { num: '1', title: '撰寫評語', desc: '在「個人評語」分頁為每位學員填寫觀察與精進建議。' },
    { num: '2', title: '管理班別', desc: '在「班別管理」建立班級、加入成員、設定重點構面。' },
    { num: '3', title: '追蹤 360°', desc: '在「360° 進度」確認各評測角色（自評／主管／同儕／部屬）是否完成。' },
  ],
};

export default function OnboardingBanner({ role = 'user' }) {
  const [dismissed, setDismissed] = useState(
    () => readJSON(STORAGE_KEY, {})[role] === true,
  );

  if (dismissed) return null;

  const steps = STEPS[role] ?? STEPS.user;

  const dismiss = () => {
    const prev = readJSON(STORAGE_KEY, {});
    writeJSON(STORAGE_KEY, { ...prev, [role]: true });
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-brand-700">
          {role === 'coach' ? '歡迎使用教練後台！以下是快速上手步驟：' : '歡迎使用全方位職能評測！以下是開始使用的步驟：'}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="關閉引導"
          className="shrink-0 text-brand-400 hover:text-brand-700"
        >
          ✕
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.num} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {s.num}
            </span>
            <div>
              <p className="text-xs font-semibold text-brand-700">{s.title}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
      >
        知道了，不再顯示
      </button>
    </div>
  );
}
