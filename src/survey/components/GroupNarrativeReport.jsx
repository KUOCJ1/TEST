import { useMemo, useState } from 'react';
import { getAssessment } from '../data/assessments/index.js';
import { buildGroupNarrative } from '../utils/narrative';

const BAND_BADGE = {
  high: { label: '集體優勢', cls: 'bg-emerald-100 text-emerald-700' },
  mid:  { label: '穩定展現', cls: 'bg-sky-100 text-sky-700' },
  low:  { label: '優先發展', cls: 'bg-amber-100 text-amber-700' },
};

function DimRow({ item }) {
  const [open, setOpen] = useState(false);
  const badge = BAND_BADGE[item.band];
  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-semibold text-slate-700">
          {item.name}
          <span className="ml-2 text-xs font-normal text-slate-400">平均 {item.avg.toFixed(1)} / 5</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
          <span className="text-slate-300">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <p className="px-4 pb-4 leading-relaxed text-slate-600">{item.text}</p>
      )}
    </div>
  );
}

/**
 * 顯示班級 / 組織整體敘事評語。
 * @param {Array}  results       班級所有成員的 result 物件陣列（含 dimensions[].subs）
 * @param {string} assessmentId  題庫 id
 */
export default function GroupNarrativeReport({ results, assessmentId }) {
  const config = getAssessment(assessmentId);
  const report = useMemo(
    () => buildGroupNarrative(results, config),
    [results, config],
  );

  if (!report) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="text-base font-bold text-slate-700">🏢 整體組織評語</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-400">
        依全體 {results.length} 位成員綜合表現自動生成，供教練規劃課程參考
      </p>

      <div className="rounded-xl border-l-4 border-violet-500 bg-violet-50/60 p-4 leading-relaxed text-slate-700">
        {report.overall}
      </div>

      {report.dimensions.length > 0 && (
        <div className="mt-4 space-y-3">
          {report.dimensions.map((item) => (
            <DimRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
