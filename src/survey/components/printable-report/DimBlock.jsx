// ─── Dimension detail block — 用於 LayerPage 內逐一列出構面 ──────────
import { buildNarrative } from '../../utils/narrative';
import { TONE_COLOR, TONE_BG, TONE_BORDER, BARS_ANCHOR } from './tokens.js';
import { toneOf, gapInfo } from './helpers.js';
import { HBar } from './primitives.jsx';

export default function DimBlock({ dim, benchPct, config }) {
  const benchAvg = benchPct != null ? benchPct / 100 * 5 : null;
  const tone = toneOf(dim.average);
  const marker = gapInfo(dim.average, benchAvg);
  const narrative = buildNarrative(dim, config, dim.id);
  const sortedSubs = dim.subs?.length > 0
    ? [...dim.subs].sort((a, b) => b.average - a.average)
    : [];

  return (
    <div style={{ marginBottom: 22, pageBreakInside: 'avoid', borderRadius: 11, border: `1px solid ${TONE_BORDER[tone]}`, overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ background: TONE_COLOR[tone], padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{dim.subtitle}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginLeft: 8 }}>{dim.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {marker && (
            <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 6px', borderRadius: 5 }}>
              {marker.symbol} {marker.label}
            </span>
          )}
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{dim.average.toFixed(1)}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>/ 5.0</span>
          <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{dim.rating.label}</span>
        </div>
      </div>

      <div style={{ padding: '12px 14px', background: TONE_BG[tone] }}>
        {/* BARS anchor */}
        <div style={{ fontSize: 10, color: TONE_COLOR[tone], fontStyle: 'italic', marginBottom: 10, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600 }}>行為錨點 ({dim.rating.label})：</span>{BARS_ANCHOR[dim.rating.label]}
        </div>

        {/* Score bar vs benchmark */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', marginBottom: 3 }}>
            <span>您的得分（滿分 5.0）</span>
            {benchAvg != null && <span>| 常模均值 {benchAvg.toFixed(1)}</span>}
          </div>
          <HBar userPct={dim.percent} benchPct={benchPct} color={TONE_COLOR[tone]} height={14} />
        </div>

        {/* Sub-dimension ranking */}
        {sortedSubs.length > 0 && (
          <div style={{ marginBottom: narrative ? 10 : 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>子能力分析（由高到低）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sortedSubs.map((sub, i) => {
                const subTone = sub.average >= 4.5 ? 'strong' : sub.average >= 3.5 ? 'good' : 'mid';
                return (
                  <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '24px 80px 1fr 42px', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: 'right' }}>#{i + 1}</span>
                    <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>{sub.name}</span>
                    <HBar userPct={(sub.average / 5) * 100} color={TONE_COLOR[subTone]} height={8} />
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{sub.average.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Narrative */}
        {narrative && (
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '9px 12px',
            fontSize: 11, color: '#334155', lineHeight: 1.8,
            borderLeft: `3px solid ${TONE_COLOR[tone]}`,
          }}>
            {narrative}
          </div>
        )}
      </div>
    </div>
  );
}
