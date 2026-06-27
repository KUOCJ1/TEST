import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import RadarChart from './RadarChart';
import { getAssessment } from '../data/assessments/index.js';
import {
  buildNarrative,
  buildOverallSummary,
  buildCoachNarrative,
  buildConsultantNarrative,
  buildDevelopmentPlan,
} from '../utils/narrative';
import { computePercentile } from '../utils/analytics';
import { formatDate } from '../utils/format';

// ─── Design tokens ─────────────────────────────────────────────
const TONE_COLOR = {
  strong: '#059669', good: '#0284c7', mid: '#d97706', low: '#ef4444', weak: '#7f1d1d',
};
const TONE_BG = {
  strong: '#f0fdf4', good: '#f0f9ff', mid: '#fffbeb', low: '#fef2f2', weak: '#fff1f2',
};
const TONE_BORDER = {
  strong: '#bbf7d0', good: '#bae6fd', mid: '#fde68a', low: '#fecaca', weak: '#fecdd3',
};

const BARS_ANCHOR = {
  '精熟': '在此能力展現模範行為，能主動應用於複雜情境並指導他人，是團隊的學習榜樣。',
  '熟練': '在多數情境中穩定展現此能力，具備良好的實踐基礎，持續精進即可達到精熟。',
  '發展中': '能在有利情境中展現此能力，但在高壓或複雜情境中仍有明顯的成長空間。',
  '萌芽': '此能力正處於發展初期，需要刻意練習、外部回饋與情境強化。',
  '待啟蒙': '此能力尚待開發，建議優先納入個人發展計畫並尋求導師指導。',
};

const RATING_SCALE = [
  { level: '精熟', range: '≥ 4.2', tone: 'strong', desc: '展現模範行為，能指導他人，在高壓情境中持續表現' },
  { level: '熟練', range: '3.4–4.19', tone: 'good', desc: '在多數情境中穩定展現，具良好實踐基礎' },
  { level: '發展中', range: '2.6–3.39', tone: 'mid', desc: '能在有利情境展現，高壓情境有待加強' },
  { level: '萌芽', range: '1.8–2.59', tone: 'low', desc: '偶爾展現，需刻意練習與強化' },
  { level: '待啟蒙', range: '< 1.8', tone: 'weak', desc: '尚待開發，應優先納入發展計畫' },
];

// ─── Utility helpers ────────────────────────────────────────────
function toneOf(avg) {
  if (avg >= 4.2) return 'strong';
  if (avg >= 3.4) return 'good';
  if (avg >= 2.6) return 'mid';
  if (avg >= 1.8) return 'low';
  return 'weak';
}

function gapInfo(userAvg, benchAvg) {
  if (benchAvg == null) return null;
  const d = userAvg - benchAvg;
  if (d >= 0.5) return { symbol: '▲', label: `+${d.toFixed(1)} 顯著優勢`, color: '#059669' };
  if (d <= -0.5) return { symbol: '▽', label: `${d.toFixed(1)} 顯著差距`, color: '#ef4444' };
  return null;
}

function layerBalance(result, benchmark, config) {
  if (!config?.LAYERS) return null;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  return config.LAYERS.map((layer) => {
    const dims = result.dimensions.filter((d) => layer.dimensions.includes(d.id));
    const userAvg = dims.reduce((s, d) => s + d.average, 0) / dims.length;
    let benchAvg = null;
    if (dimAvgs) {
      const bs = dims.map((d) => dimAvgs.find((b) => b.id === d.id)?.percent ?? null).filter((v) => v != null);
      if (bs.length) benchAvg = (bs.reduce((s, v) => s + v, 0) / bs.length) / 100 * 5;
    }
    return { id: layer.id, name: layer.name, desc: layer.desc, userAvg, benchAvg, tone: toneOf(userAvg) };
  });
}

// ─── Primitive components ───────────────────────────────────────
function HBar({ userPct, benchPct, color, height = 12 }) {
  return (
    <div style={{ position: 'relative', height, borderRadius: height, overflow: 'hidden', background: '#f1f5f9' }}>
      <div style={{ width: `${Math.min(100, userPct ?? 0)}%`, background: color, height: '100%', borderRadius: height }} />
      {benchPct != null && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, benchPct)}%`, width: 2, background: '#334155', opacity: 0.45 }} />
      )}
    </div>
  );
}

function RatingPill({ label, tone, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block', padding: `2px ${size * 0.85}px`,
      borderRadius: 20, fontSize: size, fontWeight: 700, color: '#fff',
      background: TONE_COLOR[tone] ?? '#64748b',
    }}>
      {label}
    </span>
  );
}

function InfoCard({ color, bg, border, icon, title, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.03em' }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function PageMeta({ name, section, date }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 8, color: '#94a3b8', letterSpacing: '0.04em',
      borderBottom: '0.5px solid #e2e8f0', paddingBottom: 7, marginBottom: 18,
    }}>
      <span style={{ fontWeight: 600 }}>{name} · L9D 領導力評量 · 個人評測報告</span>
      <span>{section} · {date}</span>
    </div>
  );
}

function PageFooter({ label = '本報告屬機密文件，僅限受測者及授權主管閱覽' }) {
  return (
    <div style={{
      borderTop: '0.5px solid #e2e8f0', marginTop: 20, paddingTop: 7,
      fontSize: 8, color: '#94a3b8', letterSpacing: '0.03em', textAlign: 'center',
    }}>
      {label}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>{children}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Page 1: Cover ─────────────────────────────────────────────
function CoverPage({ result, user, submittedAt, benchmark, percentile }) {
  const { total, maxScore, percent, level, dimensions, assessmentName } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBench = (id) => dimAvgs?.find((b) => b.id === id);

  return (
    <div style={{ pageBreakAfter: 'always' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4c1d95 0%, #1e40af 100%)',
        padding: '44px 52px 38px', color: '#fff',
      }}>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Confidential · 個人評測報告
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          Leadership Assessment<br />
          <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.85 }}>個人領導力評測報告</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>
          {assessmentName} · L9D · 評測日期 {formatDate(submittedAt)}
        </div>
      </div>

      {/* User + score summary */}
      <div style={{ padding: '28px 52px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start', borderBottom: '1px solid #e2e8f0', paddingBottom: 22, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>受測者</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{user?.name ?? '—'}</div>
          </div>
          {benchmark && (
            <div style={{ textAlign: 'right', fontSize: 10, color: '#94a3b8' }}>
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
              <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.7)' : '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: white ? '#fff' : '#0f172a', lineHeight: 1.1 }}>
                {value}
                {suffix && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }}>{suffix}</span>}
              </div>
              {sub && <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.65)' : '#94a3b8', marginTop: 3 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Level desc */}
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 11, color: '#4c1d95', lineHeight: 1.7 }}>
          {level.desc}
        </div>

        {/* 9-dim grid */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>九大構面落點概覽</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {dimensions.map((d) => {
              const tone = toneOf(d.average);
              const bd = getBench(d.id);
              const marker = gapInfo(d.average, bd ? bd.percent / 100 * 5 : null);
              return (
                <div key={d.id} style={{ borderRadius: 9, border: `1px solid ${TONE_BORDER[tone]}`, padding: '10px 12px', background: TONE_BG[tone] }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{d.subtitle}</span>
                    {marker && <span style={{ fontSize: 8, color: marker.color, fontWeight: 700 }}>{marker.symbol}</span>}
                  </div>
                  <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color={TONE_COLOR[tone]} height={7} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {d.average.toFixed(1)}<span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 400 }}> / 5</span>
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

// ─── Page 2: Reading Guide ──────────────────────────────────────
function ReadingGuidePage({ user, date }) {
  const overallLevels = [
    { badge: '👑 卓越領導者', range: '406–450 分', color: '#d69e2e', desc: '九大構面均高度成熟，是組織中的領導典範。' },
    { badge: '🚀 領導精熟期', range: '316–405 分', color: '#805ad5', desc: '大多數構面有優秀表現，能有效帶領團隊面對挑戰。' },
    { badge: '📈 領導發展期', range: '226–315 分', color: '#3182ce', desc: '具備一定基礎，在進階領域仍有提升空間。' },
    { badge: '🌱 領導探索期', range: '90–225 分', color: '#38a169', desc: '正處於起步階段，有初步的行為基礎，成長空間大。' },
  ];

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="閱讀指南" date={date} />
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10 }}>整體落點等級（總分 90–450）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {overallLevels.map((l) => (
              <div key={l.badge} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 8, padding: '8px 11px', border: '1px solid #e2e8f0', background: '#fafafa' }}>
                <div style={{ fontSize: 12 }}>{l.badge.split(' ')[0]}</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: l.color }}>{l.badge.slice(2)}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{l.range} · {l.desc}</div>
                </div>
              </div>
            ))}
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

      {/* Sub-dimension note */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', fontSize: 10, color: '#475569', lineHeight: 1.7 }}>
        <span style={{ fontWeight: 700 }}>子能力分析</span>：每個構面下設 2–3 個子能力，反映構面內部的細部行為。
        子能力平均高（≥ 4.5）為「<span style={{ color: '#059669', fontWeight: 600 }}>優</span>」、中（3.5–4.49）為「<span style={{ color: '#0284c7', fontWeight: 600 }}>良</span>」、低（&lt; 3.5）為「<span style={{ color: '#d97706', fontWeight: 600 }}>待強化</span>」。
        敘事評語由系統依分數自動生成，供發展參考，不代表絕對評斷。
      </div>

      <PageFooter />
    </div>
  );
}

// ─── Page 3: Executive Summary ──────────────────────────────────
function ExecutiveSummaryPage({ result, benchmark, config, user, date }) {
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
      <PageMeta name={user?.name ?? '—'} section="關鍵發現" date={date} />
      <SectionTitle sub="本頁彙整評測最核心的發現，建議優先閱讀">關鍵發現 · Key Findings</SectionTitle>

      {/* Overall summary */}
      {overall && (
        <div style={{
          background: 'linear-gradient(135deg, #faf5ff, #eff6ff)',
          border: '1px solid #e9d5ff', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20,
          fontSize: 12, color: '#3b0764', lineHeight: 1.8, fontStyle: 'italic',
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
                      <span style={{ fontSize: 9, color: '#94a3b8' }}> / 5</span>
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
              return (
                <div key={d.id} style={{
                  background: TONE_BG[tone], border: `1px solid ${TONE_BORDER[tone]}`,
                  borderRadius: 9, padding: '10px 13px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 9, color: TONE_COLOR[tone], fontWeight: 700, marginRight: 6 }}>P{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{d.subtitle}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: TONE_COLOR[tone] }}>{d.average.toFixed(1)}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8' }}> / 5</span>
                    </div>
                  </div>
                  <RatingPill label={d.rating.label} tone={tone} size={9} />
                  {marker?.color === '#ef4444' && (
                    <div style={{ fontSize: 9, color: '#ef4444', marginTop: 3 }}>{marker.label}</div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <HBar userPct={d.percent} benchPct={bd?.percent ?? null} color={TONE_COLOR[tone]} height={7} />
                  </div>
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
                    <div style={{ fontSize: 8, color: '#94a3b8' }}>{l.desc}</div>
                  </div>
                  <HBar
                    userPct={(l.userAvg / 5) * 100}
                    benchPct={l.benchAvg != null ? (l.benchAvg / 5) * 100 : null}
                    color={TONE_COLOR[tone]} height={12}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{l.userAvg.toFixed(1)}</span>
                    {benchStr && <span style={{ fontSize: 9, color: '#94a3b8' }}>{benchStr}</span>}
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

// ─── Page 4: Overview (radar + comparison) ──────────────────────
function OverviewPage({ result, benchmark, user, date }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBench = (id) => dimAvgs?.find((b) => b.id === id);
  const radarCompare = dimAvgs?.map((b) => ({ id: b.id, percent: b.percent })) ?? null;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="構面總覽" date={date} />
      <SectionTitle sub="雷達圖與各構面得分 vs 全體平均對照（| 為常模基準線）">構面落點總覽</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Radar */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>雷達圖</div>
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
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>構面得分對照表</div>
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
                        <span style={{ fontSize: 8, fontWeight: 700, color: marker.color, background: marker.color + '15', borderRadius: 4, padding: '1px 5px' }}>
                          {marker.symbol} {marker.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                      <RatingPill label={d.rating.label} tone={tone} size={9} />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{d.average.toFixed(1)}</span>
                      {benchAvg != null && (
                        <span style={{ color: '#94a3b8', fontSize: 9 }}>
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
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 10 }}>
              常模樣本：{benchmark?.count ?? '?'} 人 · | 代表常模基準線
            </div>
          )}
        </div>
      </div>

      <PageFooter />
    </div>
  );
}

// ─── Dimension detail block ──────────────────────────────────────
function DimBlock({ dim, benchPct, config }) {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', marginBottom: 3 }}>
            <span>您的得分（滿分 5.0）</span>
            {benchAvg != null && <span>| 常模均值 {benchAvg.toFixed(1)}</span>}
          </div>
          <HBar userPct={dim.percent} benchPct={benchPct} color={TONE_COLOR[tone]} height={14} />
        </div>

        {/* Sub-dimension ranking */}
        {sortedSubs.length > 0 && (
          <div style={{ marginBottom: narrative ? 10 : 0 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>子能力分析（由高到低）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sortedSubs.map((sub, i) => {
                const subTone = sub.average >= 4.5 ? 'strong' : sub.average >= 3.5 ? 'good' : 'mid';
                return (
                  <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '24px 80px 1fr 42px', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textAlign: 'right' }}>#{i + 1}</span>
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

// ─── Pages 5-7: Dimension detail by layer ──────────────────────
function LayerPage({ layer, result, benchmark, config, user, date }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const layerDims = dimensions.filter((d) => layer.dimensions.includes(d.id));

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section={layer.name} date={date} />
      {/* Layer header */}
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
          構面詳細分析 · {layer.name}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{layer.name}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{layer.desc}</div>
      </div>

      {layerDims.map((d) => {
        const bd = dimAvgs?.find((b) => b.id === d.id);
        return (
          <DimBlock key={d.id} dim={d} benchPct={bd?.percent ?? null} config={config} />
        );
      })}

      <PageFooter />
    </div>
  );
}

// ─── Page 8: Coach narrative ────────────────────────────────────
function CoachPage({ result, config, user, date }) {
  const seedBase = result.total;
  const coachText = buildCoachNarrative(result, config, seedBase);

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="教練視角" date={date} />
      <SectionTitle sub="以教練視角分析您的領導行為模式，提供個人化發展方向">教練視角 · Coach Perspective</SectionTitle>

      {coachText && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
          padding: '16px 18px', marginBottom: 20,
          fontSize: 12, color: '#0c4a6e', lineHeight: 1.85,
        }}>
          {coachText}
        </div>
      )}

      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>各構面教練評語</div>
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

      <PageFooter />
    </div>
  );
}

// ─── Page 9: Development plan ───────────────────────────────────
function DevPlanPage({ result, config, user, date }) {
  const plan = buildDevelopmentPlan(result, config);
  const HORIZON_STYLE = {
    '近期（0–3 個月）': { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '🎯' },
    '中期（3–6 個月）': { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: '📈' },
    '長期（6–12 個月）': { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '🚀' },
  };

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="發展行動計畫" date={date} />
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
        background: 'linear-gradient(135deg, #faf5ff, #eff6ff)',
        border: '1px solid #e9d5ff', borderRadius: 10, padding: '14px 18px',
        fontSize: 11, color: '#4c1d95', lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>✦ 發展建議使用說明</div>
        本計畫由系統依您的構面得分自動生成，建議與您的直屬主管或教練共同討論，
        依實際工作情境調整執行策略。每季結束後建議重新填答評量，追蹤能力成長軌跡。
      </div>

      <PageFooter label="本報告屬機密文件，僅限受測者及授權主管閱覽 · © L9D 領導力評量系統" />
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────
export default function PrintableReport({ result, benchmark, user, submittedAt, onClose }) {
  const config = getAssessment(result.assessmentId);
  const percentile = benchmark?.totals?.length >= 2
    ? computePercentile(result.total, benchmark.totals)
    : null;
  const date = formatDate(submittedAt);
  const hasSubs = result.dimensions?.some((d) => d.subs?.length > 0);
  const showNarrative = !!(config?.COMMENTARY && hasSubs);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const portal = document.getElementById('report-portal');
  if (!portal) return null;

  const layers = config?.LAYERS ?? null;

  return createPortal(
    <>
      {/* Toolbar — hidden on print */}
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>個人評測報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{result.assessmentName}</span>
          {percentile != null && (
            <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 10 }}>
              · 超越 {percentile}% 填答者
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ 列印 / 存為 PDF
          </button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ 關閉
          </button>
        </div>
      </div>

      {/* Report pages */}
      <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
        <CoverPage result={result} user={user} submittedAt={submittedAt} benchmark={benchmark} percentile={percentile} />
        <ReadingGuidePage user={user} date={date} />
        {showNarrative && <ExecutiveSummaryPage result={result} benchmark={benchmark} config={config} user={user} date={date} />}
        <OverviewPage result={result} benchmark={benchmark} user={user} date={date} />
        {layers
          ? layers.map((layer) => (
              <LayerPage key={layer.id} layer={layer} result={result} benchmark={benchmark} config={config} user={user} date={date} />
            ))
          : <LayerPage layer={{ id: 'all', name: '構面詳細分析', desc: '', dimensions: result.dimensions.map((d) => d.id) }} result={result} benchmark={benchmark} config={config} user={user} date={date} />
        }
        {showNarrative && <CoachPage result={result} config={config} user={user} date={date} />}
        {showNarrative && <DevPlanPage result={result} config={config} user={user} date={date} />}
      </div>
    </>,
    portal,
  );
}
