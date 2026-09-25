// ─── Page 3: Executive Summary ──────────────────────────────────
import { buildOverallSummary, buildConsultantNarrative } from '../../utils/narrative';
import { TONE_COLOR, TONE_BG, TONE_BORDER, DIM_DEVELOPMENT } from './tokens.js';
import { toneOf, gapInfo, layerBalance } from './helpers.js';
import { HBar, RatingPill, PageMeta, PageFooter, SectionTitle } from './primitives.jsx';

export default function ExecutiveSummaryPage({ result, benchmark, config, user, date }) {
  const { dimensions } = result;
  const seedBase = result.total;
  const overall = buildOverallSummary(result, config, seedBase);
  const consultant = buildConsultantNarrative(result, config, seedBase);
  const layers = layerBalance(result, benchmark, config);
  const sorted = [...dimensions].sort((a, b) => b.average - a.average);
  const top3 = sorted.slice(0, 3);
  const bottom2 = sorted.slice(-2).reverse();
  const dimAvgs = benchmark?.dimensionAverages ?? null;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="關鍵發現" date={date} assessmentName={result?.assessmentName} />
      <SectionTitle sub="本頁彙整評測最核心的發現，建議優先閱讀">關鍵發現 · Key Findings</SectionTitle>

      {/* Overall summary */}
      {overall && (
        <div style={{
          background: 'linear-gradient(135deg, #f6ecd7, #eff6ff)',
          border: '1px solid #e9d3a0', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20,
          fontSize: 12, color: '#584419', lineHeight: 1.8, fontStyle: 'italic',
        }}>
          {overall}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Strengths */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✨</span> 突出優勢 Top Strengths
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map((d, i) => {
              const bd = dimAvgs?.find((b) => b.id === d.id);
              const marker = gapInfo(d.average, bd ? bd.percent / 100 * 5 : null);
              return (
                <div key={d.id} style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 9, padding: '10px 13px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 9, color: '#059669', fontWeight: 700, marginRight: 6 }}>#{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#14532d' }}>{d.subtitle}</span>
                      <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{d.average.toFixed(1)}</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}> / 5</span>
                    </div>
                  </div>
                  {marker?.color === '#059669' && (
                    <div style={{ fontSize: 9, color: '#059669', marginTop: 3 }}>{marker.label}</div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color="#059669" height={7} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Development priorities */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🎯</span> 優先發展 Development Focus
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bottom2.map((d, i) => {
              const bd = dimAvgs?.find((b) => b.id === d.id);
              const marker = gapInfo(d.average, bd ? bd.percent / 100 * 5 : null);
              const tone = toneOf(d.average);
              const devInfo = DIM_DEVELOPMENT[d.id];
              return (
                <div key={d.id} style={{
                  background: TONE_BG[tone], border: `1px solid ${TONE_BORDER[tone]}`,
                  borderRadius: 9, padding: '10px 13px',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: TONE_COLOR[tone], fontWeight: 700 }}>P{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{d.subtitle}</span>
                      <RatingPill label={d.rating.label} tone={tone} size={9} />
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: TONE_COLOR[tone] }}>{d.average.toFixed(1)}</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}> / 5</span>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div style={{ marginBottom: devInfo ? 8 : 0 }}>
                    <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color={TONE_COLOR[tone]} height={7} />
                    {marker?.color === '#ef4444' && (
                      <div style={{ fontSize: 9, color: '#ef4444', marginTop: 2 }}>{marker.label}</div>
                    )}
                  </div>
                  {/* Impact + Action */}
                  {devInfo && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div style={{ background: 'rgba(220,38,38,0.07)', borderRadius: 6, padding: '7px 9px' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.05em', marginBottom: 4 }}>⚠ 影響</div>
                        <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.65 }}>{devInfo.impact}</div>
                      </div>
                      <div style={{ background: 'rgba(5,150,105,0.07)', borderRadius: 6, padding: '7px 9px' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#065f46', letterSpacing: '0.05em', marginBottom: 4 }}>💡 建議行動</div>
                        <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.65 }}>{devInfo.action}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layer balance */}
      {layers && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>三圈層均衡分析</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {layers.map((l) => {
              const tone = l.tone;
              const benchStr = l.benchAvg != null ? `常模 ${l.benchAvg.toFixed(1)}` : '';
              return (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{l.name}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{l.desc}</div>
                  </div>
                  <HBar
                    userPct={(l.userAvg / 5) * 100}
                    benchPct={l.benchAvg != null ? (l.benchAvg / 5) * 100 : null}
                    color={TONE_COLOR[tone]} height={12}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{l.userAvg.toFixed(1)}</span>
                    {benchStr && <span style={{ fontSize: 9, color: '#64748b' }}>{benchStr}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consultant insight */}
      {consultant && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '13px 16px', fontSize: 11, color: '#1e3a8a', lineHeight: 1.75 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: 6 }}>🏛 顧問視角摘要</div>
          {consultant}
        </div>
      )}

      <PageFooter />
    </div>
  );
}
