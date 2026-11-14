import { createPortal } from 'react-dom';
import { reportFilename, REPORT_KIND } from '../utils/reportFilename.js';
import { useReportFilename } from '../hooks/useReportFilename.js';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { buildPrePost } from '../utils/prePost.js';
import { buildExecutiveSummary, buildPrePostChapter } from '../utils/groupSummary.js';
import { dimLabel } from '../utils/dimensionLabel';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { GroupReadView } from './MobileReportViews.jsx';
import RadarChart from './RadarChart';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import { buildGroupNarrative, buildOverallSummary } from '../utils/narrative';
import { formatDate } from '../utils/format';

// ─── Design tokens (shared visual language with PrintableReport) ─
const TONE_COLOR = {
  strong: '#059669', good: '#0284c7', mid: '#d97706', low: '#ef4444', weak: '#7f1d1d',
};
const TONE_BG = {
  strong: '#f0fdf4', good: '#f0f9ff', mid: '#fffbeb', low: '#fef2f2', weak: '#fff1f2',
};
const TONE_BORDER = {
  strong: '#bbf7d0', good: '#bae6fd', mid: '#fde68a', low: '#fecaca', weak: '#fecdd3',
};

function toneOf(avg) {
  if (avg >= 4.2) return 'strong';
  if (avg >= 3.4) return 'good';
  if (avg >= 2.6) return 'mid';
  if (avg >= 1.8) return 'low';
  return 'weak';
}

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

function PageMeta({ groupName, section, date }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 9, color: '#64748b', letterSpacing: '0.04em',
      borderBottom: '0.5px solid #e2e8f0', paddingBottom: 7, marginBottom: 18,
    }}>
      <span style={{ fontWeight: 600 }}>{groupName} · 班級整體分析報告</span>
      <span>{section} · {date}</span>
    </div>
  );
}

function PageFooter({ label = '本報告屬機密文件，僅限授權教練及管理者閱覽' }) {
  return (
    <div style={{
      borderTop: '0.5px solid #e2e8f0', marginTop: 20, paddingTop: 7,
      fontSize: 9, color: '#64748b', letterSpacing: '0.03em', textAlign: 'center',
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
function CoverPage({ group, stats, config, memberCount }) {
  const period = group.startDate || group.endDate
    ? `${group.startDate ? formatDate(group.startDate) : '未設定'} ～ ${group.endDate ? formatDate(group.endDate) : '未設定'}`
    : '未設定施測期間';

  return (
    <div style={{ pageBreakAfter: 'always' }}>
      <div style={{
        background: '#1a4a3b',
        padding: '44px 52px 38px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><img src={`${import.meta.env.BASE_URL}logo-mark-reverse.svg`} alt="" style={{ width: 40, height: 40 }} /><span style={{ fontFamily: '"Noto Serif TC", serif', fontWeight: 900, fontSize: 20, letterSpacing: '0.02em' }}>榕光評測</span></div>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Confidential · 班級整體分析報告
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          Group Analysis Report<br />
          <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.85 }}>班級整體領導力分析報告</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>
          {config?.NAME ?? '評測'} · 報告產出日期 {formatDate(new Date().toISOString())}
        </div>
      </div>

      <div style={{ padding: '28px 52px 0' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 22, marginBottom: 22 }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>班級</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{group.name}</div>
          {group.companyName && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{group.companyName}</div>}
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>施測期間：{period}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: '已填答人數', value: stats.respondents, suffix: ` / ${memberCount} 人` },
            { label: '平均總分', value: stats.avgTotal },
            { label: '平均達成率', value: `${stats.avgPercent}%` },
            { label: '發佈狀態', value: group.publishedAt ? '已發佈' : '未發佈', bg: group.publishedAt ? '#059669' : undefined, white: !!group.publishedAt },
          ].map(({ label, value, suffix, bg, white }) => (
            <div key={label} style={{
              background: bg ?? '#f8fafc', borderRadius: 10, padding: '13px 16px',
              border: `1px solid ${bg ? 'transparent' : '#e2e8f0'}`,
            }}>
              <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.7)' : '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: white ? '#fff' : '#0f172a', lineHeight: 1.1 }}>
                {value}
                {suffix && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }}>{suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {(group.groupComment || group.groupTips?.length > 0) && (
          <div style={{ background: '#fbf7ef', border: '1px solid #e6dcc8', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: '#8a5200', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>班級整體評語</div>
            {group.groupComment && (
              <div style={{ fontSize: 11.5, color: '#4a3a12', lineHeight: 1.8, marginBottom: group.groupTips?.length ? 10 : 0 }}>
                {group.groupComment}
              </div>
            )}
            {group.groupTips?.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {group.groupTips.map((tip, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5, color: '#4a3a12' }}>
                    <span style={{ color: '#8a5200', fontWeight: 700 }}>{i + 1}.</span>{tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}

// ─── Page 2: Group overview (radar + level distribution) ────────
function OverviewPage({ group, stats, date }) {
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="班級總覽" date={date} />
      <SectionTitle sub="全班平均構面雷達圖與落點等級分佈">班級整體落點總覽</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>全班平均雷達圖</div>
          <RadarChart dimensions={stats.dimensionAverages} size={260} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>構面平均達成率</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...stats.dimensionAverages].sort((a, b) => b.percent - a.percent).map((d) => {
              const tone = toneOf((d.percent / 100) * 5);
              return (
                <div key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{d.subtitle}<span style={{ color: '#64748b', fontWeight: 400, marginLeft: 6 }}>{d.name}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TONE_COLOR[tone] }}>{d.percent}%</span>
                  </div>
                  <HBar userPct={d.percent} color={TONE_COLOR[tone]} height={10} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>落點等級人數分佈</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.levelDistribution.length}, 1fr)`, gap: 8 }}>
          {stats.levelDistribution.map((l) => (
            <div key={l.id} style={{ borderRadius: 9, border: '1px solid #e2e8f0', padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: l.color }}>{l.count}</div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>{l.badge}</div>
            </div>
          ))}
        </div>
      </div>

      <PageFooter />
    </div>
  );
}

// ─── Page 3: Group narrative ─────────────────────────────────────
function NarrativePage({ group, results, config, date }) {
  const narrative = buildGroupNarrative(results, config);
  if (!narrative) return null;

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="群體敘事分析" date={date} />
      <SectionTitle sub="系統依全班作答資料自動生成的群體敘事評語，供教練參考">群體敘事分析</SectionTitle>

      <div style={{
        background: 'linear-gradient(135deg, #fbf7ef, #eff6ff)',
        border: '1px solid #e6dcc8', borderRadius: 10,
        padding: '14px 18px', marginBottom: 20,
        fontSize: 12, color: '#4a3a12', lineHeight: 1.8, fontStyle: 'italic',
      }}>
        {narrative.overall}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {narrative.dimensions.map((d) => {
          const tone = toneOf(d.avg);
          return (
            <div key={d.id} style={{ borderRadius: 9, border: `1px solid ${TONE_BORDER[tone]}`, padding: '11px 14px', background: TONE_BG[tone] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: TONE_COLOR[tone] }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{d.avg.toFixed(1)} / 5</span>
              </div>
              <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.75 }}>{d.text}</div>
            </div>
          );
        })}
      </div>

      <PageFooter />
    </div>
  );
}

// ─── Page 4: Member ranking table ────────────────────────────────
function RankingPage({ group, rows, date }) {
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="成員排名總覽" date={date} />
      <SectionTitle sub={`依總分排序，共 ${rows.length} 位已完成作答成員`}>成員排名總覽</SectionTitle>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
            {['#', '姓名', 'Email', '總分', '達成率', '落點等級'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '7px 8px', color: '#64748b', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.userId} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
              <td style={{ padding: '7px 8px', color: '#64748b', fontWeight: 700 }}>{i + 1}</td>
              <td style={{ padding: '7px 8px', color: '#0f172a', fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: '7px 8px', color: '#64748b' }}>{r.email}</td>
              <td style={{ padding: '7px 8px', color: '#0f172a', fontWeight: 700 }}>{r.total}</td>
              <td style={{ padding: '7px 8px', color: '#334155' }}>{r.percent}%</td>
              <td style={{ padding: '7px 8px' }}>
                <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 9, fontWeight: 700, color: '#fff', background: r.level.color }}>
                  {r.level.badge}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <PageFooter />
    </div>
  );
}

// ─── Pages 5+: One-page-per-member summary ───────────────────────
function MemberSummaryPage({ group, row, stats, config, date, rank, total }) {
  const { submission } = row;
  const result = submission.result;
  const dimAvgs = stats.dimensionAverages;
  const compare = dimAvgs.map((d) => ({ id: d.id, percent: d.percent }));
  const sorted = [...result.dimensions].sort((a, b) => b.average - a.average);
  const top2 = sorted.slice(0, 2);
  const bottom2 = sorted.slice(-2).reverse();
  const overall = buildOverallSummary(result, config, result.total);
  const comments = submission.comments ?? [];

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section={`成員摘要 · ${rank}/${total}`} date={date} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>成員 #{rank}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{row.name}</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{row.email}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            {result.total}<span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}> / {result.maxScore}</span>
          </div>
          <span style={{ display: 'inline-block', marginTop: 4, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff', background: result.level.color }}>
            {result.level.badge}
          </span>
        </div>
      </div>

      {overall && (
        <div style={{ background: '#fbf7ef', border: '1px solid #e6dcc8', borderRadius: 10, padding: '12px 15px', marginBottom: 18, fontSize: 11, color: '#4a3a12', lineHeight: 1.75, fontStyle: 'italic' }}>
          {overall}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, marginBottom: 18 }}>
        <div>
          <RadarChart dimensions={result.dimensions} compare={compare} compareLabel="全班平均" size={200} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#059669', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>最強構面</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {top2.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '6px 10px' }}>
                  <span style={{ color: '#14532d', fontWeight: 600 }}>{d.subtitle}</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{d.average.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#d97706', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>優先發展</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {bottom2.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '6px 10px' }}>
                  <span style={{ color: '#78350f', fontWeight: 600 }}>{d.subtitle}</span>
                  <span style={{ color: '#d97706', fontWeight: 700 }}>{d.average.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {comments.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>指導教練回饋</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 9, padding: '10px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#0284c7', fontWeight: 700, marginBottom: 5 }}>
                  <span>{c.coachName}</span>
                  <span style={{ opacity: 0.7 }}>{formatDate(c.updatedAt)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: '#0c4a6e', lineHeight: 1.7 }}>{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PageFooter />
    </div>
  );
}

// ─── 給管理者的一頁摘要（Sprint 24）─────────────────────────────
function ExecutiveSummaryPage({ group, summary, date }) {
  const s = summary;
  const box = { border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' };
  const list = (items, tone) => items.map((d) => (
    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
      <span style={{ fontWeight: 700, color: tone }}>{dimLabel(d)}</span><span style={{ color: '#475569' }}>{d.percent}%</span>
    </div>
  ));
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="管理者摘要" date={date} />
      <SectionTitle sub="一頁看完：參與、整體狀態、優勢、優先發展、建議下一步">給管理者的一頁摘要</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={box}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>參與率</div><div style={{ fontSize: 20, fontWeight: 800 }}>{s.participation}%</div><div style={{ fontSize: 10, color: '#64748b' }}>{s.respondents} / {s.memberCount} 人完成</div></div>
        <div style={box}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>平均達成率</div><div style={{ fontSize: 20, fontWeight: 800 }}>{s.avgPercent}%</div><div style={{ fontSize: 10, color: '#64748b' }}>最新一次作答</div></div>
        <div style={box}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>課前課後變化</div>
          {s.change ? (<><div style={{ fontSize: 20, fontWeight: 800, color: s.change.meanDelta >= 0 ? '#059669' : '#b91c1c' }}>{s.change.meanDelta > 0 ? '+' : ''}{s.change.meanDelta} 分</div><div style={{ fontSize: 10, color: '#64748b' }}>{s.change.n} 人配對，{s.change.improved} 人進步</div></>) : <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>尚無足夠的前後測配對資料</div>}
        </div>
      </div>
      <div style={{ ...box, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 8 }}>整體落點分布</div>
        {s.levelDistribution.map((l) => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}><span>{l.badge}</span><strong>{l.count} 人</strong></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ ...box, background: '#f0fdf4', borderColor: '#bbf7d0' }}><div style={{ fontSize: 10, fontWeight: 800, color: '#065f46', marginBottom: 8 }}>三個優勢構面</div>{list(s.strengths, '#14532d')}</div>
        <div style={{ ...box, background: '#fffbeb', borderColor: '#fde68a' }}><div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>三個優先發展構面</div>{list(s.priorities, '#78350f')}</div>
      </div>
      {s.goals && (
        <div style={{ ...box, marginBottom: 14, fontSize: 11, color: '#334155' }}>
          <strong>行動成果：</strong>{s.goals.members} 位成員中，{s.goals.withGoal} 位（{Math.round((s.goals.withGoal / s.goals.members) * 100)}%）已設定發展目標，近 {s.goals.recentDays} 天有 {s.goals.recentCheckin} 位回報進度。
        </div>
      )}
      {s.nextSteps.length > 0 && (
        <div style={{ ...box, background: '#fbf7ef', borderColor: '#e6dcc8' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#8a5200', marginBottom: 8 }}>建議的下一步</div>
          {s.nextSteps.map((x) => <div key={x.dim} style={{ fontSize: 11, lineHeight: 1.7, color: '#4a3a12', marginBottom: 5 }}><strong>{x.dim}：</strong>{x.action}</div>)}
        </div>
      )}
      <PageFooter />
    </div>
  );
}

// ─── 課前課後比較（Sprint 24）：只比兩次都有作答的人，描述性比較 ─────
function PrePostPage({ group, chapter, date }) {
  const c = chapter;
  const sg = (n) => (n > 0 ? `+${n}` : String(n));
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="課前課後比較" date={date} />
      <SectionTitle sub={`只比較課前、課後都有作答的 ${c.n} 位成員（描述性比較，不做統計檢定）`}>課前課後比較</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[['課前平均總分', c.preTotal], ['課後平均總分', c.postTotal], ['平均變化', `${sg(c.delta)} 分`], ['進步／持平／退步', `${c.improved}／${c.same}／${c.declined}`]].map(([l, v]) => (
          <div key={l} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 17, fontWeight: 800 }}>{v}</div></div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>各構面平均（1–5 分），依進步幅度排序</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 14 }}>
        <thead><tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}><th style={{ padding: '5px 6px' }}>構面</th><th style={{ padding: '5px 6px' }}>課前</th><th style={{ padding: '5px 6px' }}>課後</th><th style={{ padding: '5px 6px' }}>變化</th><th style={{ padding: '5px 6px' }}>進步／持平／退步（人）</th></tr></thead>
        <tbody>
          {c.dimensions.map((d) => (
            <tr key={d.id} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
              <td style={{ padding: '5px 6px', fontWeight: 700 }}>{dimLabel(d)}</td>
              <td style={{ padding: '5px 6px' }}>{d.pre.toFixed(1)}</td><td style={{ padding: '5px 6px' }}>{d.post.toFixed(1)}</td>
              <td style={{ padding: '5px 6px', fontWeight: 800, color: d.delta > 0 ? '#059669' : d.delta < 0 ? '#b91c1c' : '#64748b' }}>{sg(d.delta)}</td>
              <td style={{ padding: '5px 6px', color: '#475569' }}>{d.improved}／{d.same}／{d.declined}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.8 }}>
        落點等級上升 {c.levelUp} 人、下降 {c.levelDown} 人。
        {(c.unpaired?.preOnly > 0 || c.unpaired?.postOnly > 0) && `另有 ${c.unpaired.preOnly} 人只有課前、${c.unpaired.postOnly} 人只有課後作答，未納入比較。`}
        自評分數可能因為課程後對標準的理解改變而下降，退步不一定代表能力變差，建議搭配教練的觀察一起解讀。
      </div>
      <PageFooter />
    </div>
  );
}

// ─── 課後問卷與追蹤彙總（Sprint 24）：只有伺服器已去識別化的彙總 ──────
function CourseSurveyPage({ group, summary, date }) {
  const sm = summary;
  const sat = Object.values(sm.satisfaction ?? {}).map((x) => x?.mean).filter((v) => typeof v === 'number');
  const satAvg = sat.length ? (sat.reduce((a, b) => a + b, 0) / sat.length).toFixed(1) : '—';
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta groupName={group.name} section="課後問卷" date={date} />
      <SectionTitle sub={`已完成 ${sm.completed} / ${sm.expected} 人（${sm.completionRate}%）；少於 3 人的項目不顯示`}>課後學習成效問卷</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>滿意度平均（1–5）</div><div style={{ fontSize: 20, fontWeight: 800 }}>{satAvg}</div></div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>推薦指數 NPS</div><div style={{ fontSize: 20, fontWeight: 800 }}>{sm.nps?.score ?? '—'}</div></div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>30／60 天追蹤完成</div><div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>{['stage30', 'stage60'].map((k) => { const f = sm.followUp?.[k]; return <div key={k}>{k === 'stage30' ? '30 天' : '60 天'}：{f && !f.hidden ? `${f.completed}/${f.due} 人（${f.rate}%）` : '未到期或人數不足'}</div>; })}</div></div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>能力自評：課前 vs 現在（1–5）</div>
      {(sm.dimensions ?? []).map((d) => (
        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ fontWeight: 700 }}>{d.name}</span><span>{d.before} → {d.now}（{d.gain > 0 ? '+' : ''}{d.gain}）</span>
        </div>
      ))}
      <PageFooter />
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────
export default function GroupPrintableReport({ group, submissions, users, goalSummary = null, onClose }) {
  // 客戶版：給 HR／老闆，不含個人排名與成員個別頁；教練版：保留排名與成員頁。預設客戶版。
  const [variant, setVariant] = useState('client');
  const isClient = variant === 'client';
  const filename = reportFilename({ kind: REPORT_KIND.group, assessmentId: group.assessmentId, groupName: group.name, detail: isClient ? '客戶版' : '教練版' });
  const print = useReportFilename(filename);
  const mobile = useIsMobile();
  const [showA4, setShowA4] = useState(false); // 手機：預設閱讀版，可切到 A4 原版（縮放預覽）
  const config = getAssessment(group.assessmentId);
  const date = formatDate(new Date().toISOString());
  const [courseSummary, setCourseSummary] = useState(null);
  const hasCourse = (group.extraAssessmentIds ?? []).length > 0;
  useEffect(() => {
    if (!hasCourse) return undefined;
    let active = true;
    api.getCourseSurveySummary(group.id).then((r) => active && setCourseSummary(r?.attached && !r.hidden ? r : null)).catch(() => {});
    return () => { active = false; };
  }, [group.id, hasCourse]);
  const prepost = useMemo(() => buildPrePost(submissions, config, users), [submissions, config, users]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const portal = document.getElementById('report-portal');
  if (!portal || !config) return null;

  const stats = aggregateStats(submissions, config);
  const latest = latestPerUser(submissions);
  const rows = latest
    .map((s) => {
      const u = users.find((x) => x.id === s.userId);
      return {
        submission: s,
        userId: s.userId,
        name: u?.name ?? s.userName ?? '（已移除）',
        email: u?.email ?? '—',
        total: s.result.total,
        percent: s.result.percent,
        level: s.result.level,
      };
    })
    .sort((a, b) => b.total - a.total);
  const results = latest.map((s) => s.result);
  const memberCount = group.memberIds?.length ?? rows.length;
  const summary = { ...buildExecutiveSummary({ stats, memberCount, prepost }), goals: goalSummary && !goalSummary.hidden ? goalSummary : null };
  const prePostChapter = buildPrePostChapter(prepost);

  const pages = (
    <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
      <CoverPage group={group} stats={stats} config={config} memberCount={memberCount} />
      {stats.respondents > 0 && <ExecutiveSummaryPage group={group} summary={summary} date={date} />}
      {stats.respondents > 0 && <OverviewPage group={group} stats={stats} date={date} />}
      {prePostChapter && <PrePostPage group={group} chapter={prePostChapter} date={date} />}
      {results.length >= 2 && <NarrativePage group={group} results={results} config={config} date={date} />}
      {courseSummary && <CourseSurveyPage group={group} summary={courseSummary} date={date} />}
      {!isClient && rows.length > 0 && <RankingPage group={group} rows={rows} date={date} />}
      {!isClient && rows.map((row, i) => (
        <MemberSummaryPage key={row.userId} group={group} row={row} stats={stats} config={config} date={date} rank={i + 1} total={rows.length} />
      ))}
    </div>
  );

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>班級整體分析報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{group.name} · {rows.length} 位成員</span>
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 10 }}>存檔檔名：{filename}.pdf</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={print}
            style={{ background: '#1f5d4a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ 列印 / 存為 PDF
          </button>
          <button
            onClick={() => setVariant(isClient ? 'coach' : 'client')}
            title="客戶版：不含個人排名與成員個別頁；教練版：含排名與成員頁"
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {isClient ? '目前：客戶版（切到教練版）' : '目前：教練版（切到客戶版）'}
          </button>
          {mobile && (
            <button
              onClick={() => setShowA4((v) => !v)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {showA4 ? '看閱讀版' : '看 A4 原版'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ 關閉
          </button>
        </div>
      </div>

      {mobile ? (
        <>
          {/* 手機：閱讀版（螢幕）＋A4 原版（可切換；列印一律印 A4 原版，見 index.css）。 */}
          <div className={`report-read ${showA4 ? 'report-read-hidden' : ''}`}>
            <GroupReadView group={group} stats={stats} rows={rows} results={results} config={config} date={date} summary={summary} prePostChapter={prePostChapter} courseSummary={courseSummary} showRanking={!isClient} />
          </div>
          <div className={`report-a4 ${showA4 ? '' : 'report-a4-hidden'}`}>{pages}</div>
        </>
      ) : pages}
    </>,
    portal,
  );
}
