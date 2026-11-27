import { Lock } from 'lucide-react';

// 試用帳號（推廣期自行註冊，見 server/src/lib/trial.js）：360° 與發展功能「看得到但不能用」。
// 限制由伺服器強制；這裡只負責讓使用者知道這些功能存在、為什麼現在不能用、怎麼開通。

const FEATURES = {
  '360': {
    title: '360° 多元評測',
    body: '邀請主管、同儕、部屬為你評分，比較自評與他評的落差，找出盲點與被低估的優勢。',
  },
  goals: {
    title: '發展目標',
    body: '把報告裡最想改變的一件事訂成目標，設定行動與檢視日，系統會提醒你回來追蹤進度。',
  },
  // 結果頁：發展目標與微練習合成一張精簡卡（以前兩張鎖定卡疊在一分鐘看懂下面，把雷達圖擠到很後面）。
  development: {
    title: '發展目標與四週微練習',
    body: '把報告裡最想改變的一件事訂成目標，搭配每週一個小練習，系統會提醒你回來追蹤進度。',
  },
  practice: {
    title: '四週微練習',
    body: '每週一個小練習，連續四週，把報告的建議變成習慣。',
  },
};

const UNLOCK = '試用帳號目前開放 AI 職能與 DISC 評測。參加課程、透過教練提供的連結加入班級後，就能使用完整功能。';

/** 整塊的鎖定說明卡。compact：放在報告或側欄裡的精簡版。 */
export default function TrialLock({ feature, compact = false }) {
  const f = FEATURES[feature] ?? { title: '完整版功能', body: '' };
  if (compact) {
    return (
      <div className="surface flex items-start gap-3 px-4 py-3" role="note" aria-label={`${f.title}（試用帳號未開放）`}>
        <Lock className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-700">{f.title}・完整版功能</p>
          <p className="mt-0.5">{f.body}</p>
          <p className="mt-1 text-xs text-slate-500">{UNLOCK}</p>
        </div>
      </div>
    );
  }
  return (
    <section className="surface mx-auto max-w-xl px-6 py-10 text-center" aria-label={`${f.title}（試用帳號未開放）`}>
      <Lock className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-slate-700">{f.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{f.body}</p>
      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">{UNLOCK}</p>
    </section>
  );
}

/** 按鈕型的入口（例如「訂成目標」）：顯示成停用狀態並說明原因。 */
export function TrialLockedButton({ label }) {
  return (
    <button type="button" disabled className="btn-secondary btn-sm cursor-not-allowed opacity-70" title={UNLOCK}>
      <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
      {label}（完整版）
    </button>
  );
}
