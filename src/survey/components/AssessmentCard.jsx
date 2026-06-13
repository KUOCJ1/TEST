import { getAssessment } from '../data/assessments/index.js';
import { formatDate } from '../utils/format';

export default function AssessmentCard({ assessment, latestSubmission, onStart, onViewAnalysis }) {
  const config = getAssessment(assessment.id);
  const hasResult = !!latestSubmission;

  return (
    <div className="flex flex-col rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
      <div className="flex-1">
        <h3 className="text-lg font-extrabold text-slate-800">{assessment.name}</h3>
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
          onClick={() => onStart(assessment.id)}
          className="flex-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 font-bold text-white shadow-sm transition-all hover:from-teal-600 hover:to-teal-700"
        >
          {hasResult ? '重新作答' : '開始作答'}
        </button>
        {hasResult && (
          <button
            type="button"
            onClick={() => onViewAnalysis(assessment.id)}
            className="flex-1 rounded-lg border border-teal-500 bg-white px-4 py-2.5 font-semibold text-teal-600 transition-colors hover:bg-teal-50"
          >
            查看分析
          </button>
        )}
      </div>
    </div>
  );
}
