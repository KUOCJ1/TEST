// ─── Page 1: Cover ─────────────────────────────────────────────
import { formatDate } from '../../utils/format';
import { TONE_COLOR, TONE_BG, TONE_BORDER } from './tokens.js';
import { toneOf, gapInfo } from './helpers.js';
import { HBar, RatingPill, PageFooter } from './primitives.jsx';

export default function CoverPage({ result, user, submittedAt, benchmark, percentile }) {
  const { total, maxScore, percent, level, dimensions, assessmentName } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBench = (id) => dimAvgs?.find((b) => b.id === id);

  return (
    <div style={{ pageBreakAfter: 'always' }}>
      {/* Header */}
      <div style={{
        background: '#241f18',
        padding: '44px 52px 38px', color: '#fff',
      }}>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Confidential · 個人評測報告
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.25 }}>
          {assessmentName}
          <br />
          <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.85 }}>個人評測報告</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>
          評測日期 {formatDate(submittedAt)}
        </div>
      </div>

      {/* User + score summary */}
      <div style={{ padding: '28px 52px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start', borderBottom: '1px solid #e2e8f0', paddingBottom: 22, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>受測者</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{user?.name ?? '—'}</div>
          </div>
          {benchmark && (
            <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b' }}>
              <div>常模樣本：{benchmark.count} 人</div>
              <div style={{ marginTop: 2 }}>報告產出：{formatDate(new Date().toISOString())}</div>
            </div>
          )}
        </div>

        {/* Score cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: '總得分', value: total, suffix: ` / ${maxScore}`, sub: null },
            { label: '能力達成率', value: `${percent}%`, sub: null },
            { label: '百分位排名', value: percentile != null ? `Top ${100 - percentile}%` : '—', sub: percentile != null ? `超越 ${percentile}% 填答者` : '資料不足' },
            { label: '整體落點', value: level.badge, bg: level.color, white: true },
          ].map(({ label, value, suffix, sub, bg, white }) => (
            <div key={label} style={{
              background: bg ?? '#f8fafc', borderRadius: 10, padding: '13px 16px',
              border: `1px solid ${bg ? 'transparent' : '#e2e8f0'}`,
            }}>
              <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.7)' : '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: white ? '#fff' : '#0f172a', lineHeight: 1.1 }}>
                {value}
                {suffix && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }}>{suffix}</span>}
              </div>
              {sub && <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.65)' : '#64748b', marginTop: 3 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Level desc */}
        <div style={{ background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 11, color: '#584419', lineHeight: 1.7 }}>
          {level.desc}
        </div>

        {/* 9-dim grid */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{dimensions.length} 大構面落點概覽</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {dimensions.map((d) => {
              const tone = toneOf(d.average);
              const bd = getBench(d.id);
              const marker = gapInfo(d.average, bd ? bd.percent / 100 * 5 : null);
              return (
                <div key={d.id} style={{ borderRadius: 9, border: `1px solid ${TONE_BORDER[tone]}`, padding: '10px 12px', background: TONE_BG[tone] }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{d.subtitle}</span>
                    {marker && <span style={{ fontSize: 9, color: marker.color, fontWeight: 700 }}>{marker.symbol}</span>}
                  </div>
                  <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color={TONE_COLOR[tone]} height={7} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {d.average.toFixed(1)}<span style={{ fontSize: 9, color: '#64748b', fontWeight: 400 }}> / 5</span>
                    </span>
                    <RatingPill label={d.rating.label} tone={tone} size={9} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PageFooter />
    </div>
  );
}
