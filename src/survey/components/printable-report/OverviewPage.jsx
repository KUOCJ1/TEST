// ─── Page 4: Overview (radar + comparison) ──────────────────────
import RadarChart from '../RadarChart';
import { TONE_COLOR } from './tokens.js';
import { toneOf, gapInfo } from './helpers.js';
import { HBar, RatingPill, PageMeta, PageFooter, SectionTitle } from './primitives.jsx';

export default function OverviewPage({ result, benchmark, user, date }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBench = (id) => dimAvgs?.find((b) => b.id === id);
  const radarCompare = dimAvgs?.map((b) => ({ id: b.id, percent: b.percent })) ?? null;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="構面總覽" date={date} assessmentName={result?.assessmentName} />
      <SectionTitle sub="雷達圖與各構面得分 vs 全體平均對照（| 為常模基準線）">構面落點總覽</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Radar */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>雷達圖</div>
          <RadarChart dimensions={dimensions} compare={radarCompare} compareLabel="全體平均" size={260} />
          {radarCompare && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 9, color: '#64748b' }}>
              <span>━ 您的得分</span>
              <span style={{ opacity: 0.65 }}>╌ 全體平均</span>
            </div>
          )}
        </div>

        {/* Bar table */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>構面得分對照表</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dimensions.map((d) => {
              const bd = getBench(d.id);
              const benchAvg = bd ? bd.percent / 100 * 5 : null;
              const tone = toneOf(d.average);
              const marker = gapInfo(d.average, benchAvg);
              const pctDiff = benchAvg != null ? ((d.average - benchAvg) / benchAvg * 100).toFixed(0) : null;
              return (
                <div key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE_COLOR[tone], flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{d.subtitle}</span>
                      {marker && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: marker.color, background: marker.color + '15', borderRadius: 4, padding: '1px 5px' }}>
                          {marker.symbol} {marker.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                      <RatingPill label={d.rating.label} tone={tone} size={9} />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{d.average.toFixed(1)}</span>
                      {benchAvg != null && (
                        <span style={{ color: '#64748b', fontSize: 9 }}>
                          均 {benchAvg.toFixed(1)}
                          {pctDiff != null && (
                            <span style={{ color: Number(pctDiff) >= 0 ? '#059669' : '#ef4444', marginLeft: 3 }}>
                              ({Number(pctDiff) >= 0 ? '+' : ''}{pctDiff}%)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color={TONE_COLOR[tone]} height={12} />
                </div>
              );
            })}
          </div>
          {dimAvgs && (
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 10 }}>
              常模樣本：{benchmark?.count ?? '?'} 人 · | 代表常模基準線
            </div>
          )}
        </div>
      </div>

      <PageFooter />
    </div>
  );
}
