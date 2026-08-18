import { useState } from 'react';
import { getAssessment } from '../data/assessments/index.js';
import {
  buildNarrative,
  buildOverallSummary,
  bandOf,
  buildCoachNarrative,
  buildConsultantNarrative,
  buildDevelopmentPlan,
} from '../utils/narrative';

const BAND_BADGE = {
  high: { label: '優秀表現', cls: 'bg-emerald-100 text-emerald-700' },
  mid: { label: '穩定展現', cls: 'bg-sky-100 text-sky-700' },
  low: { label: '尚待強化', cls: 'bg-amber-100 text-amber-700' },
};

const TABS = [
  { id: 'coach', label: '教練視角' },
  { id: 'consultant', label: '顧問視角' },
  { id: 'plan', label: '發展建議' },
];

function DimensionCard({ dim, config, seedBase, focus }) {
  const [open, setOpen] = useState(true);
  const text = buildNarrative(dim, config, seedBase);
  if (!text) return null;
  const badge = BAND_BADGE[bandOf(dim.average)];

  return (
    <div className={`rounded-xl border ${focus ? 'border-brass-200 bg-brass-50/40' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left print:cursor-default"
      >
        <span className="font-semibold text-slate-700">
          {focus && <span title="重點構面" className="mr-1">⭐</span>}
          <span style={{ color: dim.color }}>{dim.name}</span>
          <span className="ml-2 text-xs font-normal text-slate-400">平均 {dim.average.toFixed(1)} / 5</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
          <span className="text-slate-300 print:hidden">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      <p className={`${open ? 'block' : 'hidden'} px-4 pb-4 leading-relaxed text-slate-600 print:block`}>
        {text}
      </p>
    </div>
  );
}

/**
 * 綜合能力評語：整體總評 + 三種視角分頁（教練 / 顧問 / 發展建議）。
 * 僅在題庫設有 COMMENTARY 且結果帶有子能力分數（result.dimensions[].subs）時顯示。
 * 列印時三個分頁內容會全部展開（各自帶標題）。
 * @param {string[]} focusDimensionIds 班級設定的重點構面，會在報告中以 ⭐ 標記並優先排入發展建議。
 */
export default function NarrativeReport({ result, focusDimensionIds = [] }) {
  const [tab, setTab] = useState('coach');
  const config = getAssessment(result?.assessmentId);
  const hasSubs =
    Array.isArray(result?.dimensions) &&
    result.dimensions.some((d) => Array.isArray(d.subs) && d.subs.length > 0);
  if (!config?.COMMENTARY || !hasSubs) return null;

  const seedBase = result.total;
  const overall = buildOverallSummary(result, config, seedBase);
  const coachText = buildCoachNarrative(result, config, seedBase);
  const consultantText = buildConsultantNarrative(result, config, seedBase);
  const plan = buildDevelopmentPlan(result, config, { focusDimensionIds });

  // 列印時：未選取的分頁也要顯示 → block；螢幕上則依分頁切換。
  const panelCls = (id) => `${tab === id ? 'block' : 'hidden'} print:block`;

  return (
    <section className="mt-6 rounded-md bg-paper-50 px-5 py-6 shadow-card ring-1 ring-paper-300 sm:px-7">
      <h3 className="font-serif text-base font-bold text-ink-700">綜合能力評語</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-400">系統依各構面與子能力得分自動生成，僅供參考</p>

      {overall && (
        <div className="rounded-md bg-brass-50/60 p-4 leading-relaxed text-slate-700 ring-1 ring-brass-100">
          {overall}
        </div>
      )}

      {/* 分頁列（列印時隱藏） */}
      <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 教練視角 */}
      <div className={`mt-4 ${panelCls('coach')}`}>
        <p className="mb-2 hidden text-sm font-bold text-slate-600 print:block">教練視角</p>
        {coachText && (
          <div className="rounded-md bg-sky-50/60 p-4 leading-relaxed text-slate-700 ring-1 ring-sky-100">
            {coachText}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {result.dimensions.map((dim) => (
            <DimensionCard
              key={dim.id}
              dim={dim}
              config={config}
              seedBase={seedBase}
              focus={focusDimensionIds.includes(dim.id)}
            />
          ))}
        </div>
      </div>

      {/* 顧問視角 */}
      <div className={`mt-4 ${panelCls('consultant')}`}>
        <p className="mb-2 hidden text-sm font-bold text-slate-600 print:block">顧問視角</p>
        {consultantText ? (
          <div className="rounded-md bg-paper-200 p-4 leading-relaxed text-slate-700 ring-1 ring-paper-300">
            {consultantText}
          </div>
        ) : (
          <p className="text-sm text-slate-400">此題庫尚未提供顧問級敘事。</p>
        )}
      </div>

      {/* 發展建議 */}
      <div className={`mt-4 ${panelCls('plan')}`}>
        <p className="mb-2 hidden text-sm font-bold text-slate-600 print:block">發展建議</p>
        {plan.length > 0 ? (
          <ol className="space-y-3">
            {plan.map((p) => (
              <li key={p.id + p.horizon} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-700">
                  <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{p.horizon}</span>
                  {p.title}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {p.actions.map((a) => (
                    <li key={a} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brass-400" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-400">資料不足，無法產生發展建議。</p>
        )}
      </div>
    </section>
  );
}
