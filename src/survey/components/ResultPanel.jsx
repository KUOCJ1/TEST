import { forwardRef } from 'react';
import { Lightbulb, Target, Copy, Check, RotateCcw } from 'lucide-react';
import RadarChart from './RadarChart';
import NarrativeReport from './NarrativeReport';
import { getAssessment } from '../data/assessments/index.js';
import { buildSuggestions } from '../utils/suggestions';
import InfoTip from './InfoTip';

const ResultPanel = forwardRef(function ResultPanel(
  { result, onRetake, onCopy, copied, percentile = null, benchmarkDims = null, readOnly = false, focusDimensionIds = [] },
  ref,
) {
  const { total, maxScore, percent, level, dimensions, strongest, weakest, assessmentName } = result;
  const dimCount = dimensions.length;
  const suggestions = buildSuggestions(result, getAssessment(result.assessmentId));

  return (
    <section
      ref={ref}
      aria-live="polite"
      className="mt-8 overflow-hidden rounded-md ring-1 ring-paper-300 bg-paper-50 shadow-card"
    >
      <div className="bg-ink-700 px-6 py-7 text-center text-paper-50">
        <p className="text-sm font-medium text-paper-50/75">{assessmentName ?? '評測'} · 您的總得分</p>
        <p className="font-serif mt-1 text-5xl font-bold tracking-tight">
          {total}
          <span className="ml-1 text-xl font-semibold text-paper-50/75">/ {maxScore}</span>
        </p>
        <span
          className="mt-3 inline-block rounded-sm px-4 py-1.5 text-lg font-bold"
          style={{ background: level.color, color: '#fff' }}
        >
          {level.badge}
          {level.badgeEn && <span className="ml-2 text-sm font-normal opacity-80">{level.badgeEn}</span>}
        </span>
        <p className="mt-2 text-sm text-paper-50/75">能力達成率 {percent}%</p>
        {percentile !== null && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-sm bg-paper-50/20 px-3 py-1 text-sm font-semibold text-paper-50">
            您的總分超越了 {percentile}% 的填答者
            <InfoTip text="百分位表示你的分數在所有填答者中的相對位置。70% 代表超越了 70% 的填答者。母體隨填答人數增加而更新。" className="text-paper-50/75" />
          </p>
        )}
      </div>

      <div className="px-5 py-6 sm:px-7">
        <div className="flex flex-col items-center">
          <h3 className="mb-2 text-base font-bold text-slate-700">{dimCount} 大構面落點雷達圖</h3>
          <RadarChart
            dimensions={dimensions}
            compare={benchmarkDims}
            compareLabel="全體平均"
          />
        </div>

        <div className="mt-6 space-y-3">
          {dimensions.map((d) => (
            <div key={d.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  <span className="font-semibold" style={{ color: d.color }}>{d.subtitle}</span>
                  <span className="ml-2 text-slate-400">{d.name}</span>
                </span>
                <span className="font-semibold text-slate-600">
                  {d.score}/{d.max}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {d.rating.label}
                  </span>
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={d.score}
                aria-valuemin={0}
                aria-valuemax={d.max}
                aria-label={`${d.subtitle} ${d.name}`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.percent}%`, background: d.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">最強構面</p>
            <p className="mt-1 font-bold text-emerald-800">
              {strongest.subtitle}
              <span className="ml-2 text-sm font-normal text-emerald-600">平均 {strongest.average.toFixed(1)} 分</span>
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">優先強化</p>
            <p className="mt-1 font-bold text-amber-800">
              {weakest.subtitle}
              <span className="ml-2 text-sm font-normal text-amber-600">平均 {weakest.average.toFixed(1)} 分</span>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="leading-relaxed text-slate-700">{level.desc}</p>
        </div>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-slate-700">
            <Lightbulb className="h-4 w-4 text-brass-500" /> 學習修煉建議
          </p>
          <p className="rounded-md bg-paper-50 p-4 leading-relaxed text-slate-700 ring-1 ring-paper-300">
            {level.advice}
          </p>
        </div>

        {suggestions && (
          <div className="mt-4 rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
            <p className="mb-3 flex items-center gap-1.5 font-semibold text-slate-700">
              <Target className="h-4 w-4 text-brass-500" /> 為您客製的行動建議
            </p>
            {suggestions.develop.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">優先強化</p>
                <ul className="space-y-2">
                  {suggestions.develop.map((d) => (
                    <li key={d.id} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
                      <span><span className="font-semibold" style={{ color: d.color }}>{d.subtitle}</span>：{d.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {suggestions.leverage.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">發揮優勢</p>
                <ul className="space-y-2">
                  {suggestions.leverage.map((d) => (
                    <li key={d.id} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
                      <span><span className="font-semibold" style={{ color: d.color }}>{d.subtitle}</span>：{d.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <NarrativeReport result={result} focusDimensionIds={focusDimensionIds} />

        {!readOnly && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary flex-1"
            >
              {copied ? <><Check className="h-4 w-4" /> 已複製結果摘要</> : <><Copy className="h-4 w-4" /> 複製結果摘要</>}
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="btn flex-1 bg-slate-700 text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" /> 重新評測
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default ResultPanel;
