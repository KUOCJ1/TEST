// 領導力羅盤的列印報告（教練端／個人 PDF）。通用的 PrintableReport 頁面是為「總分＋達成率＋百分位」
// 的題庫設計的，這份評量刻意不做總分與排名，所以另有專屬版面（見 ReportPages 的分派）。
import RadarChart from '../RadarChart';
import { formatDate } from '../../utils/format';
import { buildCompassNarrative, BAND_LABEL } from '../../utils/compassNarrative.js';
import { loopBalanceText, tensionLabel, tensionText, READING_GUIDE, LOOP_EXPLAIN } from '../../utils/compassText.js';
import { HBar, PageMeta, PageFooter, SectionTitle } from '../printable-report/primitives.jsx';
import { CoachFeedbackBlock } from '../printable-report/CoachPage.jsx';

const FORM_LABEL = { short: '精簡版（32 題）', full: '完整版（69 題）' };
const pct = (avg) => Math.round((avg / 5) * 100);

function Card({ children, style }) {
  return <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', ...style }}>{children}</div>;
}

function Cover({ result, user, submittedAt, date }) {
  const { loops = [], assessmentName, form } = result;
  const balance = loopBalanceText(loops);
  return (
    <div style={{ pageBreakAfter: 'always' }}>
      <div style={{ background: '#241f18', padding: '44px 52px 38px', color: '#fff' }}>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', marginBottom: 10 }}>Confidential · 個人評測報告</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>
          {assessmentName ?? '領導力羅盤八向評測'}
          <br />
          <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.85 }}>個人報告</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>
          評測日期 {formatDate(submittedAt)}{form ? ` · ${FORM_LABEL[form] ?? form}` : ''}
        </div>
      </div>
      <div style={{ padding: '28px 52px 0' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>受測者</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{user?.name ?? '—'}</div>
        </div>

        <SectionTitle sub={LOOP_EXPLAIN}>應變環與養成環</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {loops.map((l) => (
            <Card key={l.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f172a' }}>
                <span>{l.name}<span style={{ fontSize: 9, marginLeft: 6, color: '#64748b' }}>{l.id === 'fast' ? 'FAST' : 'LAST'}</span></span>
                <span>{l.average.toFixed(1)}</span>
              </div>
              <div style={{ marginTop: 8 }}><HBar userPct={pct(l.average)} color="#2c5282" /></div>
            </Card>
          ))}
        </div>
        {balance && <div style={{ background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 11, color: '#584419', lineHeight: 1.8 }}>{balance}</div>}

        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 8 }}>怎麼讀這份報告</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#334155', lineHeight: 1.9 }}>
          {READING_GUIDE.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <PageFooter />
      </div>
      <span style={{ display: 'none' }}>{date}</span>
    </div>
  );
}

function DimensionsPage({ result, user, date }) {
  const dims = result.dimensions;
  const radarDims = dims.map((d) => ({ ...d, subtitle: d.name }));
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="八構面" date={date} assessmentName={result.assessmentName} />
      <SectionTitle sub="數值為行為頻率的平均（1–5），不是能力高低">八構面輪廓</SectionTitle>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{ width: 360 }}><RadarChart dimensions={radarDims} size={300} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 22px' }}>
        {dims.map((d) => (
          <div key={d.id} style={{ breakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
              <span>{d.name}<span style={{ fontSize: 9, fontWeight: 400, color: '#64748b', marginLeft: 6 }}>{d.subtitle}</span></span>
              <span>{d.answered > 0 ? d.average.toFixed(1) : '—'}</span>
            </div>
            <HBar userPct={pct(d.average)} color={d.color} height={8} />
            {d.subs?.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
                {d.subs.map((s) => `${s.name} ${s.answered > 0 ? s.average.toFixed(1) : '—'}`).join('　')}
              </div>
            )}
          </div>
        ))}
      </div>
      <PageFooter />
    </div>
  );
}

function TensionsPage({ result, user, date }) {
  const { tensions = [], aiProfile } = result;
  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="張力與人機協作" date={date} assessmentName={result.assessmentName} />
      <SectionTitle sub="兩端都有價值、常需取捨的行為。看的是取向與平衡，不是分數高低">四組張力</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
        {tensions.map((t) => (
          <Card key={t.id} style={{ breakInside: 'avoid', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
              <span>{t.nameA} ↔ {t.nameB}</span>
              {t.available && <span style={{ fontSize: 10, color: '#584419' }}>{tensionLabel(t)}</span>}
            </div>
            {t.available ? (
              <>
                {[[t.nameA, t.a], [t.nameB, t.b]].map(([name, v]) => (
                  <div key={name} style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569' }}><span>{name}</span><span>{v.toFixed(1)}</span></div>
                    <HBar userPct={pct(v)} color="#2c5282" height={8} />
                  </div>
                ))}
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 6 }}>平衡度 {Math.round(t.balance * 100)}%{t.lowConfidence ? '　（題目較少，僅供參考）' : ''}</div>
                <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.75, marginTop: 6 }}>{tensionText(t)}</div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>這一組的有效作答不足，暫無法呈現。</div>
            )}
          </Card>
        ))}
      </div>
      {aiProfile && (
        <>
          <SectionTitle sub={`散布在各構面、與 AI 及自動化工具協作相關的題目（共 ${aiProfile.count} 題）`}>人機協作剖面</SectionTitle>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 12 }}><span>整體平均</span><span>{aiProfile.average.toFixed(1)}</span></div>
            <div style={{ marginTop: 6 }}><HBar userPct={pct(aiProfile.average)} color="#2c5282" height={8} /></div>
            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 8, lineHeight: 1.7 }}>
              {aiProfile.byDimension.map((b) => `${b.name} ${b.average.toFixed(1)}（${b.count} 題）`).join('　')}
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 6 }}>人機協作是一種工作方式的變化，不是另一種能力。分數低代表目前較少這樣做，不代表不適合。</div>
          </Card>
        </>
      )}
      <PageFooter />
    </div>
  );
}

function NarrativePages({ result, user, date }) {
  const narrative = buildCompassNarrative(result);
  if (narrative.length === 0) return null;
  const half = Math.ceil(narrative.length / 2);
  const chunks = [narrative.slice(0, half), narrative.slice(half)].filter((c) => c.length > 0);
  return (
    <>
      {chunks.map((chunk, i) => (
        <div key={i} style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
          <PageMeta name={user?.name ?? '—'} section="各構面的解讀" date={date} assessmentName={result.assessmentName} />
          <SectionTitle sub="依您的行為頻率撰寫；同一份結果每次看到的內容相同">{i === 0 ? '各構面的解讀' : '各構面的解讀（續）'}</SectionTitle>
          {chunk.map((n) => (
            <div key={n.id} style={{ marginBottom: 16, breakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                <span>{n.name}</span><span style={{ fontSize: 9, color: '#584419' }}>{BAND_LABEL[n.band]}</span>
              </div>
              <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.85, marginTop: 4 }}>{n.intro}</div>
              {n.subs.map((s) => (
                <div key={s.id} style={{ fontSize: 10, color: '#475569', lineHeight: 1.8, marginTop: 5 }}>
                  <strong style={{ color: '#0f172a' }}>{s.name}</strong>
                  <span style={{ fontSize: 9, color: '#64748b', marginLeft: 6 }}>{BAND_LABEL[s.band]}</span>
                  <div>{s.text}</div>
                </div>
              ))}
            </div>
          ))}
          <PageFooter />
        </div>
      ))}
    </>
  );
}

export default function CompassReportPages({ result, user, submittedAt, comments = [] }) {
  const date = formatDate(submittedAt);
  return (
    <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
      <Cover result={result} user={user} submittedAt={submittedAt} date={date} />
      <DimensionsPage result={result} user={user} date={date} />
      <TensionsPage result={result} user={user} date={date} />
      <NarrativePages result={result} user={user} date={date} />
      {comments.length > 0 && (
        <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
          <PageMeta name={user?.name ?? '—'} section="教練回饋" date={date} assessmentName={result.assessmentName} />
          <SectionTitle sub="指導教練給您的回饋">教練回饋</SectionTitle>
          <CoachFeedbackBlock comments={comments} />
          <PageFooter />
        </div>
      )}
    </div>
  );
}
