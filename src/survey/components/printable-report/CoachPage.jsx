// ─── Page 8: Coach narrative ────────────────────────────────────
import { buildNarrative, buildCoachNarrative } from '../../utils/narrative';
import { formatDate } from '../../utils/format';
import { TONE_BG, TONE_BORDER, TONE_COLOR } from './tokens.js';
import { toneOf } from './helpers.js';
import { RatingPill, PageMeta, PageFooter, SectionTitle } from './primitives.jsx';

function CoachFeedbackBlock({ comments }) {
  if (!comments?.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        指導教練回饋
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comments.map((c) => (
          <div key={c.id} style={{
            background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10,
            padding: '14px 16px', fontSize: 11.5, color: '#584419', lineHeight: 1.85,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 9, color: '#8a6a2f', fontWeight: 700 }}>
              <span>{c.coachName ?? '教練'}</span>
              {c.updatedAt && <span style={{ opacity: 0.7 }}>{formatDate(c.updatedAt)}</span>}
            </div>
            <div>{c.text}</div>
            {c.tips?.length > 0 && (
              <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.tips.map((t, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
                    <span style={{ color: '#8a6a2f' }}>・</span>{t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CoachPage({ result, config, user, date, comments = [] }) {
  const seedBase = result.total;
  const coachText = config ? buildCoachNarrative(result, config, seedBase) : null;

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="教練視角" date={date} assessmentName={result?.assessmentName} />
      <SectionTitle sub="以教練視角分析您的領導行為模式，提供個人化發展方向">教練視角 · Coach Perspective</SectionTitle>

      <CoachFeedbackBlock comments={comments} />

      {coachText && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
          padding: '16px 18px', marginBottom: 20,
          fontSize: 12, color: '#0c4a6e', lineHeight: 1.85,
        }}>
          {coachText}
        </div>
      )}

      {config && (
      <>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>各構面教練評語</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {result.dimensions.map((dim) => {
          const tone = toneOf(dim.average);
          const narrative = buildNarrative(dim, config, dim.id);
          if (!narrative) return null;
          return (
            <div key={dim.id} style={{
              borderRadius: 9, border: `1px solid ${TONE_BORDER[tone]}`,
              padding: '10px 13px', background: TONE_BG[tone],
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TONE_COLOR[tone] }}>{dim.subtitle}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{dim.average.toFixed(1)}</span>
                  <RatingPill label={dim.rating.label} tone={tone} size={9} />
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.7 }}>{narrative}</div>
            </div>
          );
        }).filter(Boolean)}
      </div>
      </>
      )}

      <PageFooter />
    </div>
  );
}
