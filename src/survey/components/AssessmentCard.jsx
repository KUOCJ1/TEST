import { getAssessment } from '../data/assessments/index.js';
import { formatDate } from '../utils/format';
import PhaseBadge from './PhaseBadge';

export default function AssessmentCard({ assessment, latestSubmission, groupPhase, onStart, onViewAnalysis }) {
  const config = getAssessment(assessment.id);
  const hasResult = !!latestSubmission;
  const inGroup = groupPhase != null;
  const canStart = !inGroup || groupPhase === 'in_progress';
  const alreadySubmitted = hasResult && inGroup;

  let startLabel = hasResult ? '重新作答' : '開始作答';
  if (alreadySubmitted) startLabel = '已完成作答';
  if (!canStart && !hasResult) startLabel = '尚未開放作答';

  return (
    <div className="card flex flex-col transition-shadow hover:shadow-card-hover">
      <div className="flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold text-slate-800">{assessment.name}</h3>
          {inGroup && <PhaseBadge phase={groupPhase} />}
        </div>
        <p className="mt-1 text-sm text-slate-500">{assessment.description}</p>
        {config && (
          <p className="mt-1 text-xs text-slate-400">
            {config.TOTAL_QUESTIONS} 題 · {config.DIMENSIONS.length} 大構面
          </p>
        )}

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
                style={{ background: latestSubmission.result.level.color }}
              >
                {latestSubmission.result.level.badge}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => canStart && !alreadySubmitted && onStart(assessment.id)}
          disabled={!canStart || alreadySubmitted}
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startLabel}
        </button>
        {hasResult && (
          <button type="button" onClick={() => onViewAnalysis(assessment.id)} className="btn-secondary flex-1">
            查看分析
          </button>
        )}
      </div>
    </div>
  );
}
