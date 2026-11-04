// 核心 7 構面跨評量比較（管理後台）：L9D 與八大構面（70 題）共有的構面，用平均（1–5）並排。
// 總分範圍不同不能比，所以只比核心構面；專屬構面（思辨與決策、接班成熟度、應變與創新）不在這裡。
import { useMemo } from 'react';
import { getAssessment } from '../data/assessments/index.js';
import { CORE_DIMENSION_IDS, coreByAssessment, pairedCore } from '../utils/coreDimensions.js';

const L9D = 'leadership-9d';
const L8D = 'leadership-360-70';
const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');

export default function CoreCompareSection({ submissions }) {
  const { cols, paired } = useMemo(() => {
    const cols = coreByAssessment(submissions).filter((c) => getAssessment(c.assessmentId));
    return { cols, paired: pairedCore(submissions, L9D, L8D) };
  }, [submissions]);

  if (cols.length < 2) return null; // 只有一套評量有資料，沒有可比較的對象
  const nameOf = (id) => getAssessment(id)?.NAME ?? id;
  const dimName = (id) => getAssessment(L9D).DIMENSIONS.find((d) => d.id === id)?.name ?? id;

  return (
    <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60" aria-label="核心 7 構面跨評量比較">
      <h3 className="mb-1 text-base font-bold text-slate-700">核心 7 構面跨評量比較</h3>
      <p className="mb-4 text-xs text-slate-400">
        各評量的總分範圍不同，不能直接比。這裡只比共有的 7 個核心構面的平均（1–5 分）；每人每份評量只取最新一次自評。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">構面</th>
              {cols.map((c) => <th key={c.assessmentId} className="py-2 pr-3 font-medium">{nameOf(c.assessmentId)}<span className="ml-1 text-xs text-slate-400">（{c.n} 人）</span></th>)}
            </tr>
          </thead>
          <tbody>
            {CORE_DIMENSION_IDS.map((id) => (
              <tr key={id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-slate-700">{dimName(id)}</td>
                {cols.map((c) => <td key={c.assessmentId} className="py-2 pr-3 text-slate-600">{f2(c.dims[id])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paired && (
        <div className="mt-5">
          <h4 className="mb-1 text-sm font-bold text-slate-700">同時完成兩套評量的人（{paired.n} 人）</h4>
          <p className="mb-2 text-xs text-slate-400">差 ＝ 八大構面 − 九大構面。題目不同，差異只供參考，不代表進步或退步。</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3 font-medium">構面</th><th className="py-2 pr-3 font-medium">九大構面</th><th className="py-2 pr-3 font-medium">八大構面</th><th className="py-2 pr-3 font-medium">差</th></tr></thead>
              <tbody>
                {CORE_DIMENSION_IDS.filter((id) => paired.dims[id]).map((id) => {
                  const d = paired.dims[id];
                  return (
                    <tr key={id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">{dimName(id)}</td>
                      <td className="py-2 pr-3 text-slate-600">{f2(d.a)}</td>
                      <td className="py-2 pr-3 text-slate-600">{f2(d.b)}</td>
                      <td className="py-2 pr-3 text-slate-600">{d.diff > 0 ? '+' : ''}{f2(d.diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
