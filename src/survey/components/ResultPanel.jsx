import { forwardRef } from 'react';
import { Lightbulb, Target, Copy, Check, RotateCcw } from 'lucide-react';
import RadarChart from './RadarChart';
import NarrativeReport from './NarrativeReport';
import LearningResources from './LearningResources';
import { getAssessment } from '../data/assessments/index.js';
import { buildSuggestions } from '../utils/suggestions';
import InfoTip from './InfoTip';

const ResultPanel = forwardRef(function ResultPanel(
  { result, onRetake, onCopy, copied, percentile = null, benchmarkDims = null, readOnly = false, focusDimensionIds = [] },
  ref,
) {
  const { total, maxScore, percent, level, dimensions, strongest, weakest, assessmentName } = result;
  const dimCount = dimensions.length;
  const config = getAssessment(result.assessmentId);
  const profileMode = !!config?.PROFILE_MODE;
  // PROFILE_MODE 的「次要風格」要的是分數第二高的構面，不是 result.weakest（最低分
  // 的構面）——那是完全不同的東西，跟 getProfileLevel() 判斷風格組合用的邏輯一致。
  const bySorted = profileMode ? [...dimensions].sort((a, b) => b.average - a.average) : null;
  const primary = bySorted ? bySorted[0] : strongest;
  const secondary = bySorted ? bySorted[1] : weakest;
  const suggestions = buildSuggestions(result, config);
  // 延伸閱讀查詢的構面清單：PROFILE_MODE 用主／次要風格；一般題庫用分數最低的
  // 最多 3 個構面，不依賴 DIMENSION_ADVICE 是否存在（L9D 等沒有 DIMENSION_ADVICE
  // 的題庫不會顯示「客製化行動建議」框，但一樣值得推薦延伸閱讀）。
  const learningDimensions = profileMode
    ? [primary, secondary].filter(Boolean)
    : [...dimensions].sort((a, b) => a.average - b.average).slice(0, 3);
  const hasSubs = dimensions.some((d) => d.subs?.length > 0);
  const showNarrativeSection = !!(config?.COMMENTARY && hasSubs);

  // 報告往下捲好幾個螢幕，加一列可點的章節導覽，不必盲目滑動找內容。
  const sections = [
    { id: 'section-radar', label: '雷達圖與構面' },
    { id: 'section-suggestions', label: '強弱項與建議' },
    ...(showNarrativeSection ? [{ id: 'section-narrative', label: '敘事報告' }] : []),
  ];

  return (
    <section
      ref={ref}
      aria-live="polite"
      className="mt-8 overflow-hidden rounded-md ring-1 ring-paper-300 bg-paper-50 shadow-card"
    >
      <div className="bg-ink-700 px-6 py-7 text-center text-paper-50">
        <p className="text-sm font-medium text-paper-50/75">
          {assessmentName ?? '評測'} · {profileMode ? '您的風格輪廓' : '您的總得分'}
        </p>
        {/* PROFILE_MODE（如 DISC）構面之間沒有優劣，加總的總分／達成率／百分位排名
            都沒有意義，也暗示「分數越高越好」，這裡不顯示，只呈現風格徽章本身。 */}
        {!profileMode && (
          <p className="font-serif mt-1 text-5xl font-bold tracking-tight">
            {total}
            <span className="ml-1 text-xl font-semibold text-paper-50/75">/ {maxScore}</span>
          </p>
        )}
        <span
          className={`inline-block rounded-sm px-4 py-1.5 text-lg font-bold ${profileMode ? '' : 'mt-3'}`}
          style={{ background: level.color, color: '#fff' }}
        >
          {level.badge}
          {level.badgeEn && <span className="ml-2 text-sm font-normal opacity-80">{level.badgeEn}</span>}
        </span>
        {!profileMode && (
          <p className="mt-2 text-sm text-paper-50/75">能力達成率 {percent}%</p>
        )}
        {!profileMode && percentile !== null && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-sm bg-paper-50/20 px-3 py-1 text-sm font-semibold text-paper-50">
            您的總分超越了 {percentile}% 的填答者
            <InfoTip text="百分位表示你的分數在所有填答者中的相對位置。70% 代表超越了 70% 的填答者。母體隨填答人數增加而更新。" className="text-paper-50/75" />
          </p>
        )}
      </div>

      {sections.length > 1 && (
        <nav
          aria-label="報告章節導覽"
          className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-paper-300 bg-paper-50/95 px-5 py-2 text-xs backdrop-blur sm:px-7 print:hidden"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-semibold text-slate-500 transition-colors hover:bg-paper-200 hover:text-ink-700"
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}

      <div className="px-5 py-6 sm:px-7">
        <div id="section-radar" className="scroll-mt-14 flex flex-col items-center">
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

        <div id="section-suggestions" className="scroll-mt-14">
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {/* PROFILE_MODE：構面沒有優劣之分，兩個框都用同樣中性的配色（不用
                綠色／琥珀色的「好／待改進」對比），文字也改成「主要／次要風格」
                而非「最強／優先強化」。 */}
            <div className={`rounded-xl border px-4 py-3 ${profileMode ? 'border-brass-200 bg-brass-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${profileMode ? 'text-brass-600' : 'text-emerald-600'}`}>
                {profileMode ? '主要風格' : '最強構面'}
              </p>
              <p className={`mt-1 font-bold ${profileMode ? 'text-ink-700' : 'text-emerald-800'}`}>
                {primary.subtitle}
                <span className={`ml-2 text-sm font-normal ${profileMode ? 'text-brass-600' : 'text-emerald-600'}`}>平均 {primary.average.toFixed(1)} 分</span>
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${profileMode ? 'border-brass-200 bg-brass-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${profileMode ? 'text-brass-600' : 'text-amber-600'}`}>
                {profileMode ? '次要風格' : '優先強化'}
              </p>
              <p className={`mt-1 font-bold ${profileMode ? 'text-ink-700' : 'text-amber-800'}`}>
                {secondary.subtitle}
                <span className={`ml-2 text-sm font-normal ${profileMode ? 'text-brass-600' : 'text-amber-600'}`}>平均 {secondary.average.toFixed(1)} 分</span>
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
        </div>

        {showNarrativeSection && <div id="section-narrative" className="scroll-mt-14" />}
        <NarrativeReport result={result} focusDimensionIds={focusDimensionIds} />

        {/* 放在整份報告最後——所有章節（雷達圖、強弱項、敘事報告）都看完後，
            最後給一個「接下來可以怎麼學」的收尾，而不是夾在中間打斷報告本身。 */}
        <LearningResources assessmentId={result.assessmentId} dimensions={learningDimensions} />

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
