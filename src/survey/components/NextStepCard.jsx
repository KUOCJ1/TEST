import { ClipboardCheck, RotateCcw, Users, ChartColumn, Sparkles } from 'lucide-react';

const KIND_CONFIG = {
  pre: {
    Icon: ClipboardCheck,
    title: (s) => `開始「${s.assessmentName}」課前評測`,
    desc: () => '這是你在這門課程的基準點，作答時請依真實狀況勾選。',
    cta: '開始課前評測',
  },
  post: {
    Icon: RotateCcw,
    title: (s) => `該回來複測了：「${s.assessmentName}」課後複測`,
    desc: () => '完成後即可在「我的分析」看到與課前相比的學習成長。',
    cta: '開始課後複測',
  },
  'rate-others': {
    Icon: Users,
    title: (s) => `還有 ${s.count} 位同事等你評分`,
    desc: (s) => `「${s.assessmentName}」的 360° 多元評測需要你的回饋，花幾分鐘完成吧。`,
    cta: '前往評測他人',
  },
  'retest-reminder': {
    Icon: RotateCcw,
    title: (s) => `該回來複測了：「${s.assessmentName}」`,
    desc: (s) => `你設定的目標「${s.goalText}」建議這個時候回顧一下，看看有沒有改變。`,
    cta: '開始複測',
  },
  'view-report': {
    Icon: ChartColumn,
    title: (s) => `看看你在「${s.assessmentName}」的成長報告`,
    desc: () => '目前沒有待完成的評測，回顧一下你的落點分析與歷程吧。',
    cta: '查看我的分析',
  },
  'start-any': {
    Icon: Sparkles,
    title: (s) => `開始你的第一次評測：「${s.assessmentName}」`,
    desc: () => '完成後就能看到專屬於你的能力落點分析。',
    cta: '開始作答',
  },
};

/**
 * 首頁最上方的「下一步」卡片：把「選擇評量」從一整排卡片自己判斷，變成系統直接
 * 告訴學員現在該做什麼。資料判斷邏輯在 utils/nextStep.js（純函式、有獨立測試），
 * 這裡只負責依 kind 呈現對應文案與 CTA。
 */
export default function NextStepCard({ nextStep, onStartSurvey, onGoTo360, onViewAnalysis }) {
  if (!nextStep) return null;
  const cfg = KIND_CONFIG[nextStep.kind];
  if (!cfg) return null;

  const handleClick = () => {
    if (nextStep.kind === 'rate-others') { onGoTo360(nextStep.assessmentId); return; }
    if (nextStep.kind === 'view-report') { onViewAnalysis(nextStep.assessmentId); return; }
    onStartSurvey(nextStep.assessmentId);
  };

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl px-5 py-6 shadow-card sm:px-7" style={{ background: '#1f5d4a', color: '#ffffff' }}>
      {/* 品牌色塊：行內顏色，深色模式不被全域規則反轉。右上角的金色年輪是「榕」的意象。 */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border-2" style={{ borderColor: 'rgba(242,181,68,.45)', boxShadow: '0 0 0 18px rgba(242,181,68,.10), 0 0 0 40px rgba(242,181,68,.06)' }} />
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,.16)' }}>
            <cfg.Icon className="h-5 w-5" />
          </span>
          <div>
            {/* 深色模式下 index.css 只覆寫了 text-paper-50/75、/80 這兩個透明度變體
                （見該檔案「墨色實心區塊」段落的說明），/70 沒被涵蓋到會變成淺色字配
                反轉後的淺色底、實質看不見——這裡刻意用 /75 而不是隨手挑一個透明度。 */}
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#cfe5d6' }}>接下來</p>
            <h3 className="font-serif mt-0.5 text-xl font-semibold leading-snug">{cfg.title(nextStep)}</h3>
            <p className="mt-1 text-sm" style={{ color: '#dcefe3' }}>{cfg.desc(nextStep)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="btn-sun relative shrink-0 sm:w-auto"
        >
          {cfg.cta} →
        </button>
      </div>
    </section>
  );
}
