// ─── Page 9: Development plan ───────────────────────────────────
import { buildDevelopmentPlan } from '../../utils/narrative';
import { PageMeta, PageFooter, SectionTitle } from './primitives.jsx';

const HORIZON_STYLE = {
  '近期（0–3 個月）': { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '🎯' },
  '中期（3–6 個月）': { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: '📈' },
  '長期（6–12 個月）': { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '🚀' },
};

export default function DevPlanPage({ result, config, user, date }) {
  const plan = buildDevelopmentPlan(result, config);

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="發展行動計畫" date={date} assessmentName={result?.assessmentName} />
      <SectionTitle sub="依據您的評測結果，系統建議的三階段個人發展計畫">發展行動計畫 · Development Roadmap</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {plan.map((phase) => {
          const style = HORIZON_STYLE[phase.horizon] ?? { bg: '#f8fafc', border: '#e2e8f0', color: '#475569', icon: '📌' };
          return (
            <div key={phase.id} style={{
              background: style.bg, border: `1px solid ${style.border}`,
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{style.icon}</span>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: style.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{phase.horizon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>{phase.title}</div>
                </div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {phase.actions.map((action, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 11, color: '#334155', lineHeight: 1.7 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: style.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Closing message */}
      <div style={{
        background: 'linear-gradient(135deg, #f6ecd7, #eff6ff)',
        border: '1px solid #e9d3a0', borderRadius: 10, padding: '14px 18px',
        fontSize: 11, color: '#584419', lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>✦ 發展建議使用說明</div>
        本計畫由系統依您的構面得分自動生成，建議與您的直屬主管或教練共同討論，
        依實際工作情境調整執行策略。每季結束後建議重新填答評量，追蹤能力成長軌跡。
      </div>

      <PageFooter label={`本報告屬機密文件，僅限受測者及授權主管閱覽${result?.assessmentName ? ` · © ${result.assessmentName}` : ''}`} />
    </div>
  );
}
