import { forwardRef } from 'react';
import RadarChart from './RadarChart';
import NarrativeReport from './NarrativeReport';
import { getAssessment } from '../data/assessments/index.js';
import { buildSuggestions } from '../utils/suggestions';

const ResultPanel = forwardRef(function ResultPanel(
  { result, onRetake, onCopy, copied, percentile = null, benchmarkDims = null },
  ref,
) {
  const { total, maxScore, percent, level, dimensions, strongest, weakest, assessmentName } = result;
  const dimCount = dimensions.length;
  const suggestions = buildSuggestions(result, getAssessment(result.assessmentId));

  return (
    <section
      ref={ref}
      aria-live="polite"
      className="mt-8 overflow-hidden rounded-3xl ring-1 ring-brand-100 bg-gradient-to-b from-brand-50/60 to-white shadow-card"
    >
      <div className="bg-gradient-to-br from-brand-600 to-indigo-600 px-6 py-7 text-center text-white">
        <p className="text-sm font-medium text-brand-100">{assessmentName ?? '評測'} · 您的總得分</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight">
          {total}
          <span className="ml-1 text-xl font-semibold text-brand-100">/ {maxScore}</span>
        </p>
        <span
          className="mt-3 inline-block rounded-full px-4 py-1.5 text-lg font-bold shadow"
          style={{ background: level.color, color: '#fff' }}
        >
          {level.badge}
          {level.badgeEn && <span className="ml-2 text-sm font-normal opacity-80">{level.badgeEn}</span>}
        </span>
        <p className="mt-2 text-sm text-brand-100">能力達成率 {percent}%</p>
        {percentile !== null && (
          <p className="mt-2 inline-block rounded-full bg-brand-700/60 px-3 py-1 text-sm font-semibold text-white">
            🏆 您的總分超越了 {percentile}% 的填答者
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
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
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
          <p className="mb-2 font-semibold text-slate-700">💡 學習修煉建議</p>
          <p className="rounded-r-lg border-l-4 border-brand-500 bg-white p-4 leading-relaxed text-slate-700 shadow-sm">
            {level.advice}
          </p>
        </div>

        {suggestions && (
          <div className="mt-4 rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
            <p className="mb-3 font-semibold text-slate-700">🎯 為您客製的行動建議</p>
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

        <NarrativeReport result={result} />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
          <button
            type="button"
            onClick={onCopy}
            className="flex-1 rounded-lg border border-brand-500 bg-white px-4 py-2.5 font-semibold text-brand-600 transition-colors hover:bg-brand-50"
          >
            {copied ? '✓ 已複製結果摘要' : '📋 複製結果摘要'}
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 rounded-lg bg-slate-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            ↻ 重新評測
          </button>
        </div>
      </div>
    </section>
  );
});

export default ResultPanel;
