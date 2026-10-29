import { BarChart3, Download } from 'lucide-react';
import { getAssessment } from '../data/assessments/index.js';
import { buildPrePost, RATING_ORDER, RATING_LABEL } from '../utils/prePost.js';
import { buildCsvBlob } from '../utils/csvExport.js';
import { dimTextStyle } from '../utils/color';
import InfoTip from '../components/InfoTip';

const RATING_COLOR = { strong: '#2f855a', good: '#68a37f', mid: '#d69e2e', low: '#dd6b20', weak: '#c53030' };
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const f1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
const signed1 = (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const tone = (n) => (n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-500' : 'text-slate-400');

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold text-slate-800">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function LevelBars({ dist, n, label }) {
  return (
    <ul className="space-y-1.5" aria-label={label}>
      {dist.map((l) => (
        <li key={l.id} className="text-sm">
          <div className="flex justify-between"><span className="text-slate-600">{l.badge}</span><span className="font-semibold text-slate-700">{l.count} 人（{l.pct}%）</span></div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${n ? (l.count / n) * 100 : 0}%`, background: l.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Histogram({ bins, label }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-24 items-end gap-1">
        {bins.map((b) => (
          <div key={b.from} className="flex h-full flex-1 flex-col items-center justify-end" title={`${b.from}–${b.to} 分：${b.count} 人`}>
            <span className="text-[10px] text-slate-500">{b.count || ''}</span>
            <div className="w-full rounded-t bg-ink-700/70" style={{ height: `${(b.count / max) * 80}%`, minHeight: b.count ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {bins.map((b) => <span key={b.from} className="flex-1 text-center text-[9px] text-slate-400">{b.from}</span>)}
      </div>
    </div>
  );
}

function RatingStack({ dist, n }) {
  return (
    <div className="flex h-3 w-full min-w-[8rem] overflow-hidden rounded-full bg-slate-100" role="img"
      aria-label={RATING_ORDER.map((r) => `${RATING_LABEL[r]} ${dist[r]} 人`).join('、')}>
      {RATING_ORDER.map((r) => (dist[r] ? <div key={r} style={{ width: `${(dist[r] / n) * 100}%`, background: RATING_COLOR[r] }} title={`${RATING_LABEL[r]} ${dist[r]} 人`} /> : null))}
    </div>
  );
}

/** 前測分布 */
function PreSection({ pre }) {
  const t = pre.total;
  return (
    <section aria-label="前測分布" className="space-y-4">
      <h5 className="font-bold text-slate-700">前測分布（{pre.n} 人）</h5>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="平均總分" value={t.mean} sub={`中位數 ${t.median}`} />
        <Kpi label="標準差" value={t.sd} sub="越大代表班上程度落差越大" />
        <Kpi label="最低 – 最高" value={`${t.min} – ${t.max}`} />
        <Kpi label="人數最多的落點" value={[...pre.levelDist].sort((a, b) => b.count - a.count)[0].badge} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">落點等級分布</p>
          <LevelBars dist={pre.levelDist} n={pre.n} label="前測落點等級分布" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">總分分布（橫軸為分數區間起點）</p>
          <Histogram bins={pre.histogram} label="前測總分分布圖" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">各構面：平均與等級分布</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">構面</th><th className="pr-3 font-medium">平均（1–5）</th><th className="pr-3 font-medium">範圍</th><th className="font-medium">等級分布</th>
            </tr></thead>
            <tbody>
              {[...pre.dimensions].sort((a, b) => (a.stats?.mean ?? 0) - (b.stats?.mean ?? 0)).map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3"><span className="font-semibold dim-text" style={dimTextStyle(d.color)}>{d.subtitle}</span></td>
                  <td className="pr-3 font-semibold text-slate-700">{f1(d.stats?.mean)}</td>
                  <td className="pr-3 text-slate-500">{d.stats ? `${d.stats.min.toFixed(1)}–${d.stats.max.toFixed(1)}` : '—'}</td>
                  <td>{d.stats && <RatingStack dist={d.ratingDist} n={d.stats.n} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {RATING_ORDER.map((r) => <span key={r} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: RATING_COLOR[r] }} />{RATING_LABEL[r]}</span>)}
          <span>（依列表由弱到強排序）</span>
        </p>
      </div>
    </section>
  );
}

/** 前後測比較（配對樣本） */
function ComparisonSection({ data, config }) {
  const { paired: p, post, unpaired } = data;
  return (
    <section aria-label="前後測比較" className="space-y-4">
      <h5 className="font-bold text-slate-700">前後測比較（配對 {p.n} 人）</h5>
      {(unpaired.preOnly > 0 || unpaired.postOnly > 0) && (
        <p className="text-xs text-slate-400">只做了前測 {unpaired.preOnly} 人、只做了後測 {unpaired.postOnly} 人，未列入比較。</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="平均總分" value={`${p.pre.mean} → ${p.post.mean}`} sub={`差 ${signed(p.delta.mean)}（標準差 ${p.delta.sd}）`} />
        <Kpi label="進步／持平／退步" value={`${p.improved}／${p.same}／${p.declined} 人`} />
        <Kpi label="落點升級" value={`${p.levelUp} 人`} sub={p.levelDown ? `降級 ${p.levelDown} 人` : '無人降級'} />
        <Kpi label="效果量 dz" value={p.dz == null ? '—' : p.dz.toFixed(2)} sub={p.dz == null ? '需至少 5 人且有差異' : '約 0.2 小、0.5 中、0.8 大（參考）'} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">落點等級變化（列＝前測，欄＝後測）</p>
        <div className="overflow-x-auto">
          <table className="text-center text-sm" aria-label="落點等級變化矩陣">
            <thead><tr><th className="p-1" />{p.levelMatrix.levels.map((l) => <th key={l.id} className="p-1 text-xs font-medium text-slate-500">{l.badge}</th>)}</tr></thead>
            <tbody>
              {p.levelMatrix.levels.map((from, i) => (
                <tr key={from.id}>
                  <th scope="row" className="p-1 pr-3 text-left text-xs font-medium text-slate-500">{from.badge}</th>
                  {p.levelMatrix.counts[i].map((c, j) => (
                    <td key={j} className={`h-9 min-w-[3rem] rounded border border-slate-100 ${c ? (j > i ? 'bg-emerald-50 font-bold text-emerald-700' : j < i ? 'bg-red-50 font-bold text-red-600' : 'bg-slate-100 font-bold text-slate-700') : 'text-slate-300'}`}>{c || '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">綠色＝升級，灰色＝落點不變，紅色＝降級。</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">各構面（平均 1–5，由進步最多排序）</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">構面</th><th className="pr-3 font-medium">前測</th><th className="pr-3 font-medium">後測</th><th className="pr-3 font-medium">差</th><th className="pr-3 font-medium">進步／持平／退步</th><th className="font-medium">dz</th>
            </tr></thead>
            <tbody>
              {p.dimensions.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3"><span className="font-semibold dim-text" style={dimTextStyle(d.color)}>{d.subtitle}</span></td>
                  <td className="pr-3 text-slate-500">{f1(d.pre)}</td>
                  <td className="pr-3 font-semibold text-slate-700">{f1(d.post)}</td>
                  <td className={`pr-3 font-bold ${tone(d.delta)}`}>{signed1(d.delta)}</td>
                  <td className="pr-3 text-slate-600">{d.improved}／{d.same}／{d.declined}</td>
                  <td className="text-slate-500">{d.dz == null ? '—' : d.dz.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {p.lowerHalf && p.upperHalf && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          前測較低的一半（{p.lowerHalf.n} 人）平均進步 <strong className={tone(p.lowerHalf.meanDelta)}>{signed(p.lowerHalf.meanDelta)}</strong> 分；
          前測較高的一半（{p.upperHalf.n} 人）平均進步 <strong className={tone(p.upperHalf.meanDelta)}>{signed(p.upperHalf.meanDelta)}</strong> 分。
          <span className="text-xs text-slate-400"> 起點低的人通常有較大的進步空間，也有「回歸平均」的成分，不宜直接解讀為課程對誰更有效。</span>
        </p>
      )}

      {post && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">後測落點等級分布（{post.n} 人）</p>
          <LevelBars dist={post.levelDist} n={post.n} label="後測落點等級分布" />
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">每位成員的變化</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="每位成員前後測變化">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">姓名</th><th className="pr-3 font-medium">前測</th><th className="pr-3 font-medium">後測</th><th className="pr-3 font-medium">差</th><th className="font-medium">落點</th>
            </tr></thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-700">{r.name}</td>
                  <td className="pr-3 text-slate-500">{r.pre}</td>
                  <td className="pr-3 font-semibold text-slate-700">{r.post}</td>
                  <td className={`pr-3 font-bold ${tone(r.delta)}`}>{signed(r.delta)}</td>
                  <td className="text-slate-600">{r.preLevel?.badge === r.postLevel?.badge ? r.postLevel?.badge : `${r.preLevel?.badge} → ${r.postLevel?.badge}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => exportCsv(p, config)}
      >
        <Download className="h-3.5 w-3.5" /> 匯出前後測明細 CSV
      </button>
    </section>
  );
}

function exportCsv(p, config) {
  const dims = config.DIMENSIONS ?? [];
  const header = ['姓名', 'Email', '前測總分', '前測落點', '後測總分', '後測落點', '總分差', ...dims.flatMap((d) => [`${d.subtitle}（前）`, `${d.subtitle}（後）`])];
  const rows = p.rows.map((r) => [
    r.name, r.email, r.pre, r.preLevel?.badge ?? '', r.post, r.postLevel?.badge ?? '', r.delta,
    ...dims.flatMap((d) => [r.preDims[d.id] ?? '', r.postDims[d.id] ?? '']),
  ]);
  buildCsvBlob([header, ...rows], `${config.NAME ?? 'assessment'}-前後測明細-${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * 班級總覽的「前測分布與前後測比較」：只算每人最新一筆自評；比較只用配對樣本。
 * 風格輪廓型與專屬計分的題庫（DISC、識己、羅盤、接班）不適用，不渲染。
 */
export default function PrePostAnalysis({ group, submissions, members }) {
  const config = getAssessment(group.assessmentId);
  const data = buildPrePost(submissions, config, members);
  if (!data) return null;
  return (
    <div className="panel space-y-6">
      <h4 className="flex items-center gap-1.5 font-semibold text-slate-700">
        <BarChart3 className="h-4 w-4 text-brass-500" /> 前測分布與前後測比較
        <InfoTip text="每人各取最新一筆自評；前後測比較只計算「前測、後測都有作答」的成員（配對樣本）。人數少時只看描述數字與方向，不做顯著性檢定。" />
      </h4>
      {data.pre ? <PreSection pre={data.pre} /> : <p className="text-sm text-slate-400">尚無前測資料。</p>}
      {data.paired
        ? <ComparisonSection data={data} config={config} />
        : <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">還沒有成員同時完成前測與後測，後測有人完成後這裡會出現前後測比較。</p>}
    </div>
  );
}
