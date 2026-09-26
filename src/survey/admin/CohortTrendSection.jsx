import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { computeCohortTrend } from '../utils/analytics';
import BarList from '../components/charts/BarList';
import { formatDay } from '../utils/format';

const PHASES = [
  { id: 'pre', label: '課前' },
  { id: 'post', label: '課後' },
];

function cohortSublabel(c, { withAvg = false } = {}) {
  const parts = [
    c.startDate ? formatDay(c.startDate) : '尚未設定開課日',
    `${c.respondents} 人`,
    withAvg ? `均分 ${c.avgTotal}` : null,
    c.coachName || null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * 管理後台「跨班級／跨梯次比較」（Sprint 6 驗收條件 6.3、6.4）。
 *
 * 一般題庫：各梯平均達成率依開課日排成長條，並寫出最新一梯跟第一梯差幾個
 * 百分點。風格型題庫（PROFILE_MODE，如 DISC）沒有高低之分，不畫達成率、
 * 不算差距，改列出各梯的風格分布——沿用 Sprint 1 起「風格輪廓不暗示好壞」
 * 的呈現原則。
 */
export default function CohortTrendSection({ groups, submissions, config }) {
  const [phase, setPhase] = useState('pre');
  const { cohorts, emptyCount } = useMemo(
    () => computeCohortTrend(groups, submissions, config, phase),
    [groups, submissions, config, phase],
  );
  const profileMode = Boolean(config?.PROFILE_MODE);
  const phaseLabel = PHASES.find((p) => p.id === phase).label;

  const dated = cohorts.filter((c) => c.startDate);
  const first = dated[0];
  const latest = dated[dated.length - 1];
  const delta = !profileMode && dated.length >= 2 ? latest.avgPercent - first.avgPercent : null;

  return (
    <section className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-700">
          <TrendingUp className="h-4 w-4 text-brass-500" /> 跨班級／跨梯次比較
        </h3>
        <div role="group" aria-label="作答階段" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          {PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={phase === p.id}
              onClick={() => setPhase(p.id)}
              className={`rounded-md px-3 py-1 transition-colors ${
                phase === p.id ? 'bg-white text-brass-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        {config?.NAME} 的所有班級（不限教練），依開課日期由舊到新排列；只計算該班成員的{phaseLabel}自評，每人取最新一筆。
      </p>

      {cohorts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          此題庫目前沒有任何班級有{phaseLabel}作答資料。
        </p>
      ) : (
        <>
          {delta !== null && (
            <p className="mb-4 rounded-lg bg-brass-50 px-3 py-2 text-sm text-brass-700">
              最新一梯「{latest.name}」{phaseLabel}平均達成率 {latest.avgPercent}%，
              {delta === 0 ? '與' : '比'}第一梯「{first.name}」（{first.avgPercent}%）
              {delta === 0 ? '持平' : `${delta > 0 ? '高' : '低'} ${Math.abs(delta)} 個百分點`}。
            </p>
          )}

          {profileMode ? (
            <ul className="space-y-4">
              {cohorts.map((c) => <ProfileCohortRow key={c.id} cohort={c} />)}
            </ul>
          ) : (
            <BarList
              items={cohorts.map((c) => ({
                id: c.id,
                label: c.name,
                // 右側數值只放達成率，均分放進說明文字：手機寬度下右欄才不會被
                // 「53%（均分 98.5）」擠成好幾行。
                sublabel: cohortSublabel(c, { withAvg: true }),
                percent: c.avgPercent,
                color: '#8a6a2f',
                // 班名用一般文字色：brass-500 在深色模式的深底上對比只有約 3:1。
                labelColor: 'inherit',
              }))}
            />
          )}

          {cohorts.length === 1 && (
            <p className="mt-3 text-xs text-slate-400">目前只有 1 個班級有資料，至少需要 2 個班級才看得出趨勢。</p>
          )}
        </>
      )}

      {emptyCount > 0 && (
        <p className="mt-3 text-xs text-slate-400">另有 {emptyCount} 個班級尚無{phaseLabel}作答資料，未列入比較。</p>
      )}
    </section>
  );
}

function ProfileCohortRow({ cohort }) {
  const present = cohort.levelDistribution.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  return (
    <li>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-semibold text-slate-700">{cohort.name}</span>
        <span className="text-xs text-slate-400">{cohortSublabel(cohort)}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {present.map((d) => (
          <div key={d.id} className="h-full" style={{ width: `${(d.count / cohort.respondents) * 100}%`, background: d.color }} />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {present.map((d) => `${d.badge} ${d.count} 人`).join('、')}
      </p>
    </li>
  );
}
