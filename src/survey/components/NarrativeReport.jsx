import { useState } from 'react';
import { getAssessment } from '../data/assessments/index.js';
import { buildNarrative, buildOverallSummary, bandOf } from '../utils/narrative';

const BAND_BADGE = {
  high: { label: '優秀表現', cls: 'bg-emerald-100 text-emerald-700' },
  mid: { label: '穩定展現', cls: 'bg-sky-100 text-sky-700' },
  low: { label: '尚待強化', cls: 'bg-amber-100 text-amber-700' },
};

function DimensionCard({ dim, config, seedBase }) {
  const [open, setOpen] = useState(true);
  const text = buildNarrative(dim, config, seedBase);
  if (!text) return null;
  const badge = BAND_BADGE[bandOf(dim.average)];

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left print:cursor-default"
      >
        <span className="font-semibold text-slate-700">
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
 * 綜合能力評語：報告最上方一段整體總評，下方每構面一張可展開卡片。
 * 僅在題庫設有 COMMENTARY 且結果帶有子能力分數（result.dimensions[].subs）時顯示。
 */
export default function NarrativeReport({ result }) {
  const config = getAssessment(result?.assessmentId);
  const hasSubs =
    Array.isArray(result?.dimensions) &&
    result.dimensions.some((d) => Array.isArray(d.subs) && d.subs.length > 0);
  if (!config?.COMMENTARY || !hasSubs) return null;

  const seedBase = result.total;
  const overall = buildOverallSummary(result, config, seedBase);

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="text-base font-bold text-slate-700">📝 綜合能力評語</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-400">系統依各構面與子能力得分自動生成，僅供參考</p>

      {overall && (
        <div className="rounded-xl border-l-4 border-teal-500 bg-teal-50/60 p-4 leading-relaxed text-slate-700">
          {overall}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {result.dimensions.map((dim) => (
          <DimensionCard key={dim.id} dim={dim} config={config} seedBase={seedBase} />
        ))}
      </div>
    </section>
  );
}
