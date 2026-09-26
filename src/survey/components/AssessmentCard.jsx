import { getAssessment } from '../data/assessments/index.js';
import { formatDate } from '../utils/format';
import PhaseBadge from './PhaseBadge';
import { badgeBg } from '../utils/color';

export default function AssessmentCard({
  assessment, latestSubmission, groupPhase, submittedPhases, onStart, onViewAnalysis, onGoTo360,
}) {
  const config = getAssessment(assessment.id);
  const hasResult = !!latestSubmission;
  const inGroup = groupPhase != null;
  const canStart = !inGroup || groupPhase === 'in_progress';
  // 課前、課後都做過才算「這個班真的沒有可以再做的了」；只做過課前的話，
  // 按鈕仍要能點——使用者要靠它才能進去選「課後複測」。
  const alreadySubmitted = inGroup && !!submittedPhases?.has('pre') && !!submittedPhases?.has('post');
  const supports360 = !!config?.SUPPORTS_360;

  let startLabel = hasResult ? '重新作答' : '開始作答';
  if (!canStart && !hasResult) startLabel = '尚未開放作答';

  // 狀態標籤：跟 startLabel（按鈕文字，偏「接下來要做什麼」）分開，這個是純粹
  // 陳述「目前完成到哪」的事實標籤，讓使用者不用讀按鈕文字也能一眼掃過去。
  let statusLabel = '未作答';
  let statusClass = 'bg-slate-100 text-slate-500';
  if (inGroup) {
    if (submittedPhases?.has('post')) { statusLabel = '課後已完成'; statusClass = 'bg-emerald-50 text-emerald-600'; }
    else if (submittedPhases?.has('pre')) { statusLabel = '課前已完成'; statusClass = 'bg-blue-50 text-blue-600'; }
  } else if (hasResult) {
    statusLabel = '可重測';
    statusClass = 'bg-brass-50 text-brass-600';
  }

  return (
    <div className="card flex flex-col transition-shadow hover:shadow-card-hover">
      <div className="flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold text-slate-800">{assessment.name}</h3>
          {inGroup && <span className="shrink-0"><PhaseBadge phase={groupPhase} /></span>}
        </div>
        <p className="mt-1 text-sm text-slate-500">{assessment.description}</p>
        {config && (
          <p className="mt-1 text-xs text-slate-400">
            {config.TOTAL_QUESTIONS} 題 · {config.DIMENSIONS.length} 大構面
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`chip ${statusClass}`}>{statusLabel}</span>
          {supports360 && (
            <span className="chip bg-brass-50 text-brass-600">支援 360° 多元評測</span>
          )}
        </div>

        {hasResult && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium text-slate-400">最近作答 · {formatDate(latestSubmission.createdAt)}</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-2xl font-extrabold text-slate-800">
                {latestSubmission.result.total}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  / {latestSubmission.result.maxScore}
                </span>
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: badgeBg(latestSubmission.result.level.color) }}
              >
                {latestSubmission.result.level.badge}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 一個主要動作＋次要動作（Sprint 8 驗收條件 8.4）。以前三顆等寬按鈕擠在一排，
          卡片一窄就斷成「重新作／答」「查看分／析」；做完的班級還留著一顆灰色的停用
          按鈕。現在：做過的評量主要動作是「查看分析」，沒做過是「開始作答」，其餘放在
          下方一排小按鈕；按鈕文字一律不換行。 */}
      <div className="mt-5 space-y-2">
        {hasResult ? (
          <button type="button" onClick={() => onViewAnalysis(assessment.id)} className="btn-primary w-full whitespace-nowrap">
            查看分析
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canStart && onStart(assessment.id)}
            disabled={!canStart}
            className="btn-primary w-full whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            {startLabel}
          </button>
        )}
        {(hasResult || (supports360 && onGoTo360)) && (
          <div className="flex flex-wrap gap-2">
            {hasResult && !alreadySubmitted && canStart && (
              <button type="button" onClick={() => onStart(assessment.id)} className="btn-secondary btn-sm flex-1 whitespace-nowrap">
                {startLabel}
              </button>
            )}
            {/* 360° 入口維持按鈕的份量（對應 S-02：以前只是一行文字連結，容易被忽略）。 */}
            {supports360 && onGoTo360 && (
              <button type="button" onClick={() => onGoTo360(assessment.id)} className="btn-secondary btn-sm flex-1 whitespace-nowrap">
                360° 評測 →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
