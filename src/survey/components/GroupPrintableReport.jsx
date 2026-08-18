import { createPortal } from 'react-dom';
import { useEffect } from 'react';
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
        background: '#241f18',
        padding: '44px 52px 38px', color: '#fff',
      }}>
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
          <div style={{ background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: '#8a6a2f', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>班級整體評語</div>
            {group.groupComment && (
              <div style={{ fontSize: 11.5, color: '#584419', lineHeight: 1.8, marginBottom: group.groupTips?.length ? 10 : 0 }}>
                {group.groupComment}
              </div>
            )}
            {group.groupTips?.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {group.groupTips.map((tip, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5, color: '#584419' }}>
                    <span style={{ color: '#8a6a2f', fontWeight: 700 }}>{i + 1}.</span>{tip}
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
        background: 'linear-gradient(135deg, #f6ecd7, #eff6ff)',
        border: '1px solid #e9d3a0', borderRadius: 10,
        padding: '14px 18px', marginBottom: 20,
        fontSize: 12, color: '#584419', lineHeight: 1.8, fontStyle: 'italic',
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
        <div style={{ background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10, padding: '12px 15px', marginBottom: 18, fontSize: 11, color: '#584419', lineHeight: 1.75, fontStyle: 'italic' }}>
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

// ─── Main export ───────────────────────────────────────────────
export default function GroupPrintableReport({ group, submissions, users, onClose }) {
  const config = getAssessment(group.assessmentId);
  const date = formatDate(new Date().toISOString());

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

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>班級整體分析報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{group.name} · {rows.length} 位成員</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#8a6a2f', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
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

      <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
        <CoverPage group={group} stats={stats} config={config} memberCount={group.memberIds?.length ?? rows.length} />
        {stats.respondents > 0 && <OverviewPage group={group} stats={stats} date={date} />}
        {results.length >= 2 && <NarrativePage group={group} results={results} config={config} date={date} />}
        {rows.length > 0 && <RankingPage group={group} rows={rows} date={date} />}
        {rows.map((row, i) => (
          <MemberSummaryPage
            key={row.userId}
            group={group}
            row={row}
            stats={stats}
            config={config}
            date={date}
            rank={i + 1}
            total={rows.length}
          />
        ))}
      </div>
    </>,
    portal,
  );
}
