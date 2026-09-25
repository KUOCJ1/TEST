// ─── Page 2: Reading Guide ──────────────────────────────────────
// 落點等級、分數區間、子能力說明全部改由題庫設定推導——同一支元件會印出不同
// 題庫（AI 職能／L9D 領導力）的報告，寫死 L9D 的內容會讓其他題庫的報告出現
// 錯誤的評量名稱與分數級距。
import { TONE_BG, TONE_BORDER, TONE_COLOR, RATING_SCALE } from './tokens.js';
import { PageMeta, PageFooter, SectionTitle, RatingPill } from './primitives.jsx';

export default function ReadingGuidePage({ user, date, config, result, hasSubs }) {
  const assessmentName = result?.assessmentName;
  const profileMode = !!config?.PROFILE_MODE;
  const levels = Array.isArray(config?.LEVELS) ? config.LEVELS : [];
  const overallLevels = [...levels]
    .sort((a, b) => (b.min ?? 0) - (a.min ?? 0))
    .map((l) => ({
      badge: l.badge,
      // PROFILE_MODE（如 DISC）的風格組合沒有分數區間可言——l.min/l.max 不存在，
      // 這裡就不顯示「undefined–undefined 分」。
      range: l.min != null && l.max != null ? `${l.min}–${l.max} 分` : '',
      color: l.color,
      // 題庫設定的 desc 是完整段落，這張對照表只有 9pt 的空間，取第一句即可。
      desc: (l.desc ?? '').split('。')[0].trim(),
    }));
  const minScore = config?.MIN_SCORE ?? result?.minScore;
  const maxScore = config?.MAX_SCORE ?? result?.maxScore;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="閱讀指南" date={date} assessmentName={assessmentName} />
      <SectionTitle sub="本頁說明如何解讀報告中的各項指標與圖表">如何閱讀本報告</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Rating scale */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10 }}>構面評級量表（1–5 分）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {RATING_SCALE.map((r) => (
              <div key={r.level} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: TONE_BG[r.tone], border: `1px solid ${TONE_BORDER[r.tone]}`,
                borderRadius: 8, padding: '8px 11px',
              }}>
                <div style={{ minWidth: 44 }}>
                  <RatingPill label={r.level} tone={r.tone} size={9} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: TONE_COLOR[r.tone], marginBottom: 1 }}>{r.range}</div>
                  <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Overall levels + chart guide */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
            {profileMode
              ? '風格組合對照表'
              : `整體落點等級${minScore != null && maxScore != null ? `（總分 ${minScore}–${maxScore}）` : ''}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {overallLevels.map((l) => {
              // badge 格式為「<emoji> <名稱>」，拆出來讓 emoji 獨立顯示於左側。
              const spaceAt = l.badge.indexOf(' ');
              const icon = spaceAt > 0 ? l.badge.slice(0, spaceAt) : '';
              const label = spaceAt > 0 ? l.badge.slice(spaceAt + 1) : l.badge;
              return (
                <div key={l.badge} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 8, padding: '8px 11px', border: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <div style={{ fontSize: 12 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: l.color }}>{label}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{l.range && `${l.range} · `}{l.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>圖表閱讀說明</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10, color: '#475569', lineHeight: 1.6 }}>
            {[
              { icon: '📡', title: '雷達圖', desc: '實線多邊形為您的得分，虛線為全體平均，越靠外圍表現越好。' },
              { icon: '━', title: '條狀圖', desc: '色條長度代表您的得分；直線「|」為全體常模基準線。' },
              { icon: '▲', title: '顯著優勢', desc: '您的構面得分比常模高出 0.5 分以上。' },
              { icon: '▽', title: '顯著差距', desc: '您的構面得分比常模低 0.5 分以上，為優先發展區。' },
            ].map((item) => (
              <div key={item.title} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, minWidth: 18 }}>{item.icon}</span>
                <div><span style={{ fontWeight: 600 }}>{item.title}</span>：{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-dimension note — 只有設有子能力的題庫才需要這段說明 */}
      {hasSubs && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', fontSize: 10, color: '#475569', lineHeight: 1.7 }}>
          <span style={{ fontWeight: 700 }}>子能力分析</span>：每個構面下設數個子能力，反映構面內部的細部行為。
          子能力平均高（≥ 4.5）為「<span style={{ color: '#059669', fontWeight: 600 }}>優</span>」、中（3.5–4.49）為「<span style={{ color: '#0284c7', fontWeight: 600 }}>良</span>」、低（&lt; 3.5）為「<span style={{ color: '#d97706', fontWeight: 600 }}>待強化</span>」。
          敘事評語由系統依分數自動生成，供發展參考，不代表絕對評斷。
        </div>
      )}

      <PageFooter />
    </div>
  );
}
