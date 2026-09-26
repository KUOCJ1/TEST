import { TrendingUp } from 'lucide-react';
import { computeGroupGain } from '../utils/analytics';
import { getAssessment } from '../data/assessments/index.js';
import InfoTip from '../components/InfoTip';
import { dimTextStyle } from '../utils/color';

/**
 * 班級學習成效報告（Sprint 4 驗收條件 4.3）：課前 vs 課後，只算配對樣本
 * （同一人課前課後都做過才算），對企業客戶交付成果最有說服力的數字。
 *
 * PROFILE_MODE 題庫（如 DISC）構面沒有優劣，不呈現「增益」這種暗示越高越好
 * 的數字，改呈現風格分布變化——跟第 1 章「風格輪廓沒有好壞」的報告原則一致。
 */
export default function GroupGainReport({ group, submissions }) {
  const config = getAssessment(group.assessmentId);
  const gain = computeGroupGain(submissions, config);

  if (!gain) return null;

  return (
    <div className="panel">
      <h4 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
        <TrendingUp className="h-4 w-4 text-brass-500" /> 班級學習成效
        <InfoTip text="只計算「課前、課後都有作答」的成員（配對樣本），避免拿不對等的兩批人比較出沒有意義的數字。" />
      </h4>
      <p className="mb-4 text-xs text-slate-400">配對樣本 {gain.pairedCount} 人（課前＋課後皆完成）</p>

      {gain.profileMode ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">課前風格分布</p>
            <ul className="space-y-1.5">
              {gain.preDistribution.map((d) => (
                <li key={d.badge} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{d.badge}</span>
                  <span className="font-semibold text-slate-700">{d.count} 人</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">課後風格分布</p>
            <ul className="space-y-1.5">
              {gain.postDistribution.map((d) => (
                <li key={d.badge} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{d.badge}</span>
                  <span className="font-semibold text-slate-700">{d.count} 人</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">班級平均總分增益</p>
            <p className={`mt-0.5 text-2xl font-extrabold ${gain.avgTotalDelta > 0 ? 'text-emerald-600' : gain.avgTotalDelta < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {gain.avgTotalDelta > 0 ? `+${gain.avgTotalDelta}` : gain.avgTotalDelta}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {gain.mostImproved && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">進步最多</p>
                <p className="mt-0.5 font-bold text-emerald-800">
                  {gain.mostImproved.subtitle}
                  <span className="ml-2 text-sm font-normal">{gain.mostImproved.avgDelta > 0 ? `+${gain.mostImproved.avgDelta}` : gain.mostImproved.avgDelta}</span>
                </p>
              </div>
            )}
            {gain.leastImproved && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">進步最少</p>
                <p className="mt-0.5 font-bold text-amber-800">
                  {gain.leastImproved.subtitle}
                  <span className="ml-2 text-sm font-normal">{gain.leastImproved.avgDelta > 0 ? `+${gain.leastImproved.avgDelta}` : gain.leastImproved.avgDelta}</span>
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 text-left font-medium">構面</th>
                  <th className="py-2 text-right font-medium">平均增益</th>
                </tr>
              </thead>
              <tbody>
                {gain.dimensionDeltas.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-semibold dim-text" style={dimTextStyle(d.color)}>{d.subtitle}</span>
                    </td>
                    <td className={`py-2 text-right font-bold ${d.avgDelta > 0 ? 'text-emerald-600' : d.avgDelta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {d.avgDelta > 0 ? `+${d.avgDelta}` : d.avgDelta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
