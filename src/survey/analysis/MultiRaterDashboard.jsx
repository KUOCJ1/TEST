import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '../api/client';
import RadarChart from '../components/RadarChart';
import { RATER_LABELS } from '../constants/raterTypes';

const RATER_COLORS = {
  self: '#7c3aed',
  manager: '#2563eb',
  peer: '#059669',
  subordinate: '#d97706',
};

// Average an array of numbers
function avg(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Given a list of submissions, compute per-dimension average score (1-5 scale) and percent.
function avgDimensions(subs) {
  if (!subs.length) return [];
  const dimMap = new Map();
  for (const s of subs) {
    for (const d of s.result?.dimensions ?? []) {
      if (!dimMap.has(d.id)) dimMap.set(d.id, { ...d, percents: [], averages: [] });
      const entry = dimMap.get(d.id);
      entry.percents.push(d.percent ?? 0);
      // score / max * 5 to get 1-5 scale average
      const max = d.max ?? 1;
      entry.averages.push((d.score / max) * 5);
    }
  }
  return [...dimMap.values()].map((e) => ({
    id: e.id,
    name: e.name,
    subtitle: e.subtitle,
    color: e.color,
    percent: Math.round(avg(e.percents)),
    avgScore: Math.round(avg(e.averages) * 10) / 10,
  }));
}

// Composite "others" = all non-self rater types together
function compositeOthers(byType) {
  const otherSubs = Object.entries(byType)
    .filter(([t]) => t !== 'self')
    .flatMap(([, subs]) => subs);
  return avgDimensions(otherSubs);
}

// ── Self vs Others Radar Panel ─────────────────────────────────
function RadarPanel({ selfDims, othersDims }) {
  if (!selfDims.length) return null;
  const compare = othersDims.map((d) => ({ id: d.id, percent: d.percent }));
  return (
    <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 text-base font-bold text-slate-700">自評 vs 他評綜合雷達圖</h3>
      <p className="mb-4 text-xs text-slate-400">實線＝自評；虛線＝其他評測者綜合平均</p>
      <div className="flex justify-center">
        <RadarChart
          dimensions={selfDims}
          compare={compare.length ? compare : null}
          compareLabel="他評綜合平均"
        />
      </div>
    </div>
  );
}

// ── Per-Rater-Type Bar Chart Panel ────────────────────────────
function BarPanel({ byType, dimensions }) {
  const types = Object.keys(RATER_LABELS).filter((t) => byType[t]?.length);
  if (!dimensions.length || !types.length) return null;

  return (
    <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 text-base font-bold text-slate-700">各評測者類型分數比較</h3>
      <p className="mb-4 text-xs text-slate-400">每構面顯示各評測者類型的達成百分比</p>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: RATER_COLORS[t] }} />
            {RATER_LABELS[t]}（{byType[t].length} 份）
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {dimensions.map((dim) => (
          <div key={dim.id}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: dim.color }}>{dim.subtitle}</span>
              <span className="text-xs text-slate-400">{dim.name}</span>
            </div>
            <div className="space-y-1.5">
              {types.map((t) => {
                const typeDims = avgDimensions(byType[t]);
                const d = typeDims.find((x) => x.id === dim.id);
                const pct = d?.percent ?? 0;
                return (
                  <div key={t} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right text-xs text-slate-500">{RATER_LABELS[t]}</span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: RATER_COLORS[t] }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-xs font-bold text-slate-700">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Self-Awareness Gap Table ───────────────────────────────────
function GapPanel({ selfDims, othersDims }) {
  if (!selfDims.length || !othersDims.length) return null;

  const rows = selfDims
    .map((d) => {
      const o = othersDims.find((x) => x.id === d.id);
      const selfScore = d.avgScore ?? 0;
      const othersScore = o?.avgScore ?? 0;
      const gap = Math.round((selfScore - othersScore) * 10) / 10;
      return { ...d, selfScore, othersScore, gap };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return (
    <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 text-base font-bold text-slate-700">自我認知落差分析</h3>
      <p className="mb-4 text-xs text-slate-400">落差＝自評 − 他評均值；正值代表高估、負值代表低估自己（以絕對值降序排列）</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 text-left font-medium">構面</th>
              <th className="py-2 pr-4 text-right font-medium">自評</th>
              <th className="py-2 pr-4 text-right font-medium">他評均</th>
              <th className="py-2 text-right font-medium">落差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const gapColor = d.gap > 0.5 ? 'text-red-500' : d.gap < -0.5 ? 'text-blue-600' : 'text-emerald-600';
              const gapSign = d.gap > 0 ? '+' : '';
              return (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold" style={{ color: d.color }}>{d.subtitle}</span>
                    <span className="ml-2 text-xs text-slate-400">{d.name}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-slate-700">{d.selfScore.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">{d.othersScore.toFixed(1)}</td>
                  <td className={`py-2.5 text-right font-bold ${gapColor}`}>
                    {gapSign}{d.gap.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
        <span><span className="font-bold text-red-500">落差 &gt; +0.5</span>：可能高估自我，他人看法較低</span>
        <span><span className="font-bold text-blue-600">落差 &lt; −0.5</span>：可能低估自我，他人看法較高</span>
      </div>
    </div>
  );
}

// ── 360° Quadrant Chart ───────────────────────────────────────
function QuadrantPanel({ selfDims, othersDims }) {
  if (!selfDims.length || !othersDims.length) return null;

  const W = 380, H = 280, PAD = 50;
  const plotW = W - PAD * 2, plotH = H - PAD * 2;
  const toX = (v) => PAD + ((v - 1) / 4) * plotW;
  const toY = (v) => H - PAD - ((v - 1) / 4) * plotH;
  const midX = toX(3.5), midY = toY(3.5);

  const points = selfDims.map((d) => {
    const o = othersDims.find((x) => x.id === d.id);
    return { ...d, sx: d.avgScore ?? 3, ox: o?.avgScore ?? 3 };
  });

  const quadrants = [
    { x: midX + 2, y: PAD + 2, label: '核心優勢', color: '#d1fae5', textColor: '#065f46' },
    { x: PAD + 2, y: PAD + 2, label: '被低估潛能', color: '#dbeafe', textColor: '#1e40af' },
    { x: midX + 2, y: midY + 2, label: '高估自我', color: '#fee2e2', textColor: '#991b1b' },
    { x: PAD + 2, y: midY + 2, label: '共同發展區', color: '#fef3c7', textColor: '#92400e' },
  ];

  return (
    <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 text-base font-bold text-slate-700">360° 四象限分析</h3>
      <p className="mb-4 text-xs text-slate-400">X 軸＝他評均分；Y 軸＝自評分；分割線為 3.5 分</p>
      <div className="flex justify-center overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
          {/* Quadrant backgrounds */}
          <rect x={midX} y={PAD} width={W - PAD - midX} height={midY - PAD} fill="#d1fae5" opacity="0.4" />
          <rect x={PAD} y={PAD} width={midX - PAD} height={midY - PAD} fill="#dbeafe" opacity="0.4" />
          <rect x={midX} y={midY} width={W - PAD - midX} height={H - PAD - midY} fill="#fee2e2" opacity="0.4" />
          <rect x={PAD} y={midY} width={midX - PAD} height={H - PAD - midY} fill="#fef3c7" opacity="0.4" />

          {/* Axes */}
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Mid lines */}
          <line x1={midX} y1={PAD} x2={midX} y2={H - PAD} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />

          {/* Quadrant labels */}
          {quadrants.map((q, i) => (
            <text key={i} x={q.x + 4} y={q.y + 14} fontSize="10" fontWeight="700" fill={q.textColor} opacity="0.8">{q.label}</text>
          ))}

          {/* Axis labels */}
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">← 他評均分 (1–5) →</text>
          <text x={12} y={H / 2} textAnchor="middle" fontSize="11" fill="#64748b" transform={`rotate(-90, 12, ${H / 2})`}>← 自評 →</text>
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <text x={toX(v)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{v}</text>
              <text x={PAD - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
            </g>
          ))}

          {/* Data points */}
          {points.map((p) => {
            const px = toX(p.ox);
            const py = toY(p.sx);
            return (
              <g key={p.id}>
                <circle cx={px} cy={py} r="10" fill={p.color} stroke="white" strokeWidth="1.5" />
                <text x={px} y={py + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
                  {p.subtitle.slice(0, 2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { bg: '#d1fae5', text: '#065f46', label: '核心優勢', desc: '自他皆高' },
          { bg: '#dbeafe', text: '#1e40af', label: '被低估潛能', desc: '他高自低' },
          { bg: '#fee2e2', text: '#991b1b', label: '高估自我', desc: '自高他低' },
          { bg: '#fef3c7', text: '#92400e', label: '共同發展區', desc: '自他皆低' },
        ].map((q) => (
          <div key={q.label} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: q.bg, border: `1px solid ${q.text}` }} />
            <span><span className="font-semibold" style={{ color: q.text }}>{q.label}</span>（{q.desc}）</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function MultiRaterDashboard({ rateeId, rateeName, assessmentId, canDeanonymize = false }) {
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.rateeSubmissions(rateeId, assessmentId, { deanonymize: canDeanonymize })
      .then((list) => active && setSubs(list))
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, [rateeId, assessmentId, canDeanonymize]);

  if (subs === null && !error) {
    return <p className="py-16 text-center text-slate-400">載入 360° 資料中…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-red-500">{error}</p>;
  }

  // Group by raterType, deduplicate: keep latest per (userId, raterType)
  const byType = {};
  for (const s of subs) {
    const t = s.raterType ?? 'self';
    if (!byType[t]) byType[t] = [];
    byType[t].push(s);
  }

  const selfSubs = byType['self'] ?? [];
  const latestSelf = selfSubs[0] ?? null;
  const selfDims = latestSelf ? (latestSelf.result?.dimensions ?? []).map((d) => ({
    ...d,
    avgScore: d.max ? Math.round((d.score / d.max) * 50) / 10 : 0,
  })) : [];

  const othersDims = compositeOthers(byType);
  const allDimsRef = selfDims.length ? selfDims : othersDims;

  const hasOthers = Object.entries(byType).some(([t, s]) => t !== 'self' && s.length > 0);

  if (!selfSubs.length && !hasOthers) {
    return (
      <div className="py-16 text-center text-slate-400">
        <Users className="mx-auto h-10 w-10 text-brass-300" />
        <p className="mt-3 font-semibold text-slate-600">尚無 360° 評測資料</p>
        <p className="mt-1 text-sm">請邀請主管、同儕或部屬完成評測後再查看。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-xl font-extrabold text-slate-800">{rateeName} — 360° 多元視角分析</h3>
        <p className="mt-1 text-sm text-slate-500">
          {selfSubs.length > 0 && `自評 1 份`}
          {Object.entries(byType)
            .filter(([t, s]) => t !== 'self' && s.length)
            .map(([t, s]) => `  ${RATER_LABELS[t]} ${s.length} 份`)
            .join('')}
        </p>
      </header>

      {selfDims.length > 0 && othersDims.length > 0 && (
        <RadarPanel selfDims={selfDims} othersDims={othersDims} />
      )}

      {allDimsRef.length > 0 && Object.keys(byType).length > 1 && (
        <BarPanel byType={byType} dimensions={allDimsRef} />
      )}

      {selfDims.length > 0 && othersDims.length > 0 && (
        <GapPanel selfDims={selfDims} othersDims={othersDims} />
      )}

      {selfDims.length > 0 && othersDims.length > 0 && (
        <QuadrantPanel selfDims={selfDims} othersDims={othersDims} />
      )}

      {!hasOthers && selfDims.length > 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
          目前只有自評資料。邀請主管、同儕或部屬完成評測後，這裡將顯示多元視角比較分析。
        </div>
      )}
    </div>
  );
}
