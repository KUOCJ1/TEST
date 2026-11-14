import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { build360Report } from '../utils/report360.js';
import { RATER_LABELS } from '../constants/raterTypes';
import { formatDate } from '../utils/format';
import RadarChart from './RadarChart';
import { TONE_COLOR, RATING_SCALE } from './printable-report/tokens.js';
import { toneOf } from './printable-report/helpers.js';
import { PageFooter, SectionTitle } from './printable-report/primitives.jsx';
import InsightBlock from './printable-report/InsightBlock.jsx';
import { SubRanking, DimGroupBars, SubGroupBars, Contents } from './threesixty/GroupCharts.jsx';
import { reportFilename, REPORT_KIND } from '../utils/reportFilename.js';
import { useReportFilename } from '../hooks/useReportFilename.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { ThreeSixtyReadView } from './MobileReportViews.jsx';

// 360° 完整報告（列印／存為 PDF）：封面、整體評價、自評 vs 他評、各構面與子能力、發展建議與討論。
// 資料整理在 utils/report360.js；這裡只負責版面。評分者只以「類別」呈現（主管／同儕／部屬），不列姓名。

// 連續排版：各章節接續往下排（不再每章強制換頁，避免每頁只有半頁）；卡片與表格用 breakInside 避免被切斷。
const SECTION = { marginTop: 26 };
const f1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
const signed = (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const KIND = {
  blind: { label: '自評高於他評', color: '#dc2626', note: '可能的盲點：自己覺得做到、他人感受較少' },
  hidden: { label: '他評高於自評', color: '#0284c7', note: '被低估的優勢：他人看見的比自己以為的多' },
  aligned: { label: '看法一致', color: '#059669', note: '' },
  unknown: { label: '—', color: '#94a3b8', note: '' },
};

function Chip({ children, color }) {
  return <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, color, background: `${color}18`, borderRadius: 4, padding: '1px 6px' }}>{children}</span>;
}

function Score({ value, bold }) {
  if (typeof value !== 'number') return <span style={{ color: '#cbd5e1' }}>—</span>;
  return <span style={{ fontWeight: bold ? 800 : 600, color: TONE_COLOR[toneOf(value)] }}>{f1(value)}</span>;
}

function DimList({ items, valueKey, empty }) {
  if (!items.length) return <div style={{ fontSize: 11, color: '#94a3b8' }}>{empty}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((d) => (
        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: '#334155' }}>{d.name}</span>
          <span style={{ color: '#475569' }}>{valueKey === 'gap' ? `自評 ${f1(d.self)}／他評 ${f1(d.others)}（差 ${signed(d.gap)}）` : f1(d[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

function Cover({ r, name, date }) {
  return (
    <div>
      <div style={{ background: '#1a4a3b', padding: '34px 40px 30px', color: '#fff', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><img src={`${import.meta.env.BASE_URL}logo-mark-reverse.svg`} alt="" style={{ width: 40, height: 40 }} /><span style={{ fontFamily: '"Noto Serif TC", serif', fontWeight: 900, fontSize: 20, letterSpacing: '0.02em' }}>榕光評測</span></div>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', marginBottom: 10 }}>CONFIDENTIAL · 360° FEEDBACK REPORT</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>{r.assessmentName}<br /><span style={{ fontSize: 20, fontWeight: 600, opacity: 0.85 }}>360° 完整回饋報告</span></div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>報告日期 {date}</div>
      </div>
      <div style={{ padding: '22px 4px 0' }}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>受評者</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 22 }}>{name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>自評</div>
            {r.self ? (<><div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{r.self.total}</div><div style={{ fontSize: 11, color: '#475569' }}>{r.self.level?.badge}</div></>) : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>尚無自評</div>}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>他評（平均）</div>
            {r.othersSummary ? (<><div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{r.othersSummary.total}</div><div style={{ fontSize: 11, color: '#475569' }}>{r.othersSummary.level?.badge}</div></>) : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>尚無他評</div>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          評分者組成：{r.hasSelf ? '自評 1 份' : '無自評'}
          {['manager', 'peer', 'subordinate'].filter((t) => r.counts[t]).map((t) => `、${RATER_LABELS[t]} ${r.counts[t]} 位`).join('')}
          {!r.hasOthers && '（尚無他評）'}
        </div>
      </div>
    </div>
  );
}

/** 報告最前面：評量項目與定義、評估方式。讓閱讀者先知道「評什麼」與「分數怎麼來」。 */
function Framework({ r }) {
  const f = r.framework;
  if (!f || f.dimensions.length === 0) return null;
  const labels = f.scale.labels.length ? f.scale.labels.map((l, i) => `${f.scale.min + i}＝${l}`).join('、') : `${f.scale.min}–${f.scale.max} 分`;
  const th = { textAlign: 'left', padding: '5px 6px', fontWeight: 700 };
  const card = { border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', breakInside: 'avoid', pageBreakInside: 'avoid' };
  const bullets = { margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 10.5, lineHeight: 1.8, color: '#334155' };
  return (
    <div style={SECTION}>
      <div style={{ breakInside: 'avoid' }}>
        <SectionTitle sub={`本報告評量 ${f.dimensions.length} 個構面、共 ${f.itemCount} 題行為描述；先看評什麼、再看分數怎麼來`}>評量項目與定義</SectionTitle>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginBottom: 18 }}>
        <thead><tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}><th style={th}>構面</th><th style={th}>定義</th><th style={th}>子能力</th><th style={{ ...th, textAlign: 'center' }}>題數</th></tr></thead>
        <tbody>
          {f.dimensions.map((d) => (
            <tr key={d.id} style={{ borderBottom: '0.5px solid #f1f5f9', breakInside: 'avoid', verticalAlign: 'top' }}>
              <td style={{ padding: '6px', whiteSpace: 'nowrap', fontWeight: 700, color: '#0f172a' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 6 }} />{d.name}
                <div style={{ fontSize: 8.5, fontWeight: 500, color: '#94a3b8', marginLeft: 14 }}>{d.subtitle}</div>
              </td>
              <td style={{ padding: '6px', color: '#334155', lineHeight: 1.7 }}>{d.definition}</td>
              <td style={{ padding: '6px', color: '#475569', lineHeight: 1.7 }}>{d.subs.join('、')}</td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#475569' }}>{d.items}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ breakInside: 'avoid' }}>
        <SectionTitle sub="分數如何計算、如何解讀">評估方式</SectionTitle>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>誰來評分、怎麼作答</div>
          <ul style={bullets}>
            <li>受評者本人（自評），以及主管、同儕、部屬從各自的角度，回答同一份行為描述的題目。</li>
            <li>每題依「這個行為實際出現的程度」作答，量表 {labels}。</li>
            <li>評分者只以類別（主管／同儕／部屬）呈現，不列姓名；同一位評分者重複作答時只採計最新一次。</li>
          </ul>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>分數怎麼算</div>
          <ul style={bullets}>
            <li>子能力分數＝該子能力所屬題目的平均；構面分數＝該構面全部題目的平均，皆為 {f.scale.min}–{f.scale.max} 分。</li>
            <li>各類評分者的分數，是該類評分者的平均；「他評合計」是所有他評評分者的平均，<strong>每位評分者權重相同</strong>，不會因為某一類人數較多而偏重。</li>
            <li>他評的整體落點，是所有他評評分者總分的平均（四捨五入）對照下表等級。</li>
          </ul>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>構面等級（依構面分數）</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <tbody>
              {RATING_SCALE.map((x) => (
                <tr key={x.level} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 6px', fontWeight: 700, color: TONE_COLOR[x.tone], whiteSpace: 'nowrap' }}>{x.level}</td>
                  <td style={{ padding: '3px 6px', color: '#64748b', whiteSpace: 'nowrap' }}>{x.range}</td>
                  <td style={{ padding: '3px 6px', color: '#334155' }}>{x.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {f.levels.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>整體落點（依總分）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <tbody>
                {f.levels.map((l) => (
                  <tr key={l.badge} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                    <td style={{ padding: '3px 6px', fontWeight: 700, color: '#0f172a' }}>{l.badge}</td>
                    <td style={{ padding: '3px 6px', color: '#64748b' }}>{l.min}–{l.max} 分</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>自評與他評的差距</div>
          <ul style={bullets}>
            <li>差距＝自評 − 他評合計。<strong>差距 ≥ {f.gapThreshold.toFixed(1)}</strong>：自評高於他評，可能的盲點（自己覺得做到、他人感受較少）。</li>
            <li><strong>差距 ≤ −{f.gapThreshold.toFixed(1)}</strong>：他評高於自評，是被低估的優勢（他人看見的比自己以為的多）。</li>
            <li>分數與等級門檻是依本題庫推算的暫定值，用來引發對話，不是對一個人的評定；評分者人數少時，單一評分者的影響較大。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Overall({ r }) {
  const basisNote = r.basis === 'others' ? '以下的強項與發展方向，以「他人眼中」的分數為依據。' : '目前沒有他評，以下以自評為依據。';
  return (
    <div style={SECTION}>
      <SectionTitle sub={basisNote}>整體評價</SectionTitle>
      {r.summaryText && <p style={{ fontSize: 12, lineHeight: 1.85, color: '#334155', margin: '0 0 20px' }}>{r.summaryText}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46', marginBottom: 8 }}>{r.basis === 'others' ? '他人眼中的三大強項' : '三大強項（自評）'}</div>
          <DimList items={r.strengths} valueKey={r.basis === 'others' ? 'others' : 'self'} empty="資料不足" />
        </div>
        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>優先發展的三個構面</div>
          <DimList items={r.develop} valueKey={r.basis === 'others' ? 'others' : 'self'} empty="資料不足" />
        </div>
      </div>
      {r.hasSelf && r.hasOthers && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', marginBottom: 2 }}>可能的盲點（自評高於他評）</div>
            <div style={{ fontSize: 9, color: '#991b1b', opacity: 0.75, marginBottom: 8 }}>差距 ≥ 0.5：自己覺得做到、他人感受較少</div>
            <DimList items={r.blind} valueKey="gap" empty="沒有明顯高估的構面" />
          </div>
          <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#075985', marginBottom: 2 }}>被低估的優勢（他評高於自評）</div>
            <div style={{ fontSize: 9, color: '#075985', opacity: 0.75, marginBottom: 8 }}>差距 ≤ −0.5：他人看見的比自己以為的多</div>
            <DimList items={r.hidden} valueKey="gap" empty="沒有明顯低估的構面" />
          </div>
        </div>
      )}
    </div>
  );
}

function Compare({ r }) {
  const dims = r.dimensions;
  const pct = (v) => (typeof v === 'number' ? Math.round((v / 5) * 100) : 0);
  const radarSelf = dims.map((d) => ({ id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, percent: pct(d.self ?? d.others) }));
  const radarCompare = r.hasSelf && r.hasOthers ? dims.map((d) => ({ id: d.id, percent: pct(d.others) })) : null;
  return (
    <div style={SECTION}>
      <div style={{ breakInside: 'avoid' }}>
        <SectionTitle sub="分數為 1–5 的平均；同一類評分者取平均，「他評合計」為所有他評評分者的平均">各構面：自評與各類評分者</SectionTitle>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <RadarChart dimensions={radarSelf} compare={radarCompare} compareLabel="他評" size={250} />
        </div>
        {radarCompare && <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 9, color: '#64748b', marginBottom: 14 }}><span>━ 自評</span><span style={{ opacity: 0.65 }}>╌ 他評合計</span></div>}
      </div>
      <DimGroupBars r={r} labels={r.framework?.scale.labels ?? []} kindInfo={KIND} />
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>差距＝自評 − 他評合計；橫條旁的數字是各群組的平均分（1–5）。</div>
    </div>
  );
}

function SubRankingSection({ r }) {
  if (!r.subRanking?.all.length) return null;
  return (
    <div style={SECTION}>
      <div style={{ breakInside: 'avoid' }}><SectionTitle sub={`${r.subRanking.all.length} 個子能力依${r.basis === 'others' ? '他人眼中' : '自評'}的分數由高到低排列`}>子能力排名</SectionTitle></div>
      <SubRanking r={r} labels={r.framework?.scale.labels ?? []} />
    </div>
  );
}

function DimensionDetails({ r }) {
  return (
    <div style={SECTION}>
      {r.dimensions.map((d, i) => (
        // 第一張卡片和章節標題綁在一起，標題不會單獨落在頁尾。
        <div key={d.id} style={i === 0 ? { breakInside: 'avoid' } : undefined}>
          {i === 0 && <SectionTitle sub="各構面的子能力得分、自評與他評對照，以及依他人眼中的表現整理的評語">構面與子能力詳述</SectionTitle>}
          <div style={{ pageBreakInside: 'avoid', marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 8 }} />{d.name}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>自評 <Score value={d.self} bold />&emsp;他評 <Score value={d.others} bold />{d.gap != null && d.kind !== 'aligned' && <> <Chip color={KIND[d.kind].color}>{KIND[d.kind].label} {signed(d.gap)}</Chip></>}</div>
          </div>
          {r.dimTexts?.[d.id] && <p style={{ fontSize: 11, lineHeight: 1.8, color: '#0f172a', fontWeight: 600, margin: '0 0 8px' }}>{r.dimTexts[d.id]}</p>}
          {r.narratives[d.id] && <p style={{ fontSize: 11, lineHeight: 1.8, color: '#334155', margin: '0 0 10px' }}>{r.narratives[d.id]}</p>}
          <SubGroupBars dim={d} labels={r.framework?.scale.labels ?? []} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanCard({ p }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#8a5200', marginBottom: 3 }}>{p.horizon}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{p.title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 11, lineHeight: 1.75, color: '#334155' }}>{p.actions.map((a) => <li key={a}>{a}</li>)}</ul>
    </div>
  );
}

function PlanPage({ r }) {
  const prompts = [];
  if (r.blind[0]) prompts.push(`在「${r.blind[0].name}」，您的自評（${f1(r.blind[0].self)}）高於他人的看法（${f1(r.blind[0].others)}）。您認為他人沒有感受到的是哪些行為？有沒有具體的情境可以回想？`);
  if (r.hidden[0]) prompts.push(`在「${r.hidden[0].name}」，他人（${f1(r.hidden[0].others)}）比您自己（${f1(r.hidden[0].self)}）看到更多優勢。這些行為您是怎麼做到的？可以怎麼更有意識地運用？`);
  if (r.develop[0]) prompts.push(`在「${r.develop[0].name}」，他人眼中的分數是 ${f1(r.develop[0].others ?? r.develop[0].self)}。您想先改變的一個具體行為是什麼？需要誰的支持？`);
  prompts.push('不同評分者（主管、同儕、部屬）的看法有哪些差異？背後可能的原因是什麼？');
  prompts.push('這份回饋中，最讓您意外的是哪一點？最想先採取的第一個行動是什麼？');
  return (
    <div style={SECTION}>
      <InsightBlock insights={r.insights} />
      <div style={{ breakInside: 'avoid' }}>
        <SectionTitle sub="依他人眼中的表現整理；可作為與受評者面談時的討論素材">發展建議</SectionTitle>
        {r.plan[0] && <PlanCard p={r.plan[0]} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22, marginTop: 12 }}>
        {r.plan.slice(1).map((p) => <PlanCard key={p.id} p={p} />)}
      </div>
      <SectionTitle sub="面談時可以從這幾題開始">討論題</SectionTitle>
      <ol style={{ margin: '0 0 22px', paddingLeft: 20, listStyle: 'decimal', fontSize: 11, lineHeight: 1.85, color: '#334155' }}>{prompts.map((p) => <li key={p}>{p}</li>)}</ol>
      <div style={{ fontSize: 9.5, color: '#64748b', lineHeight: 1.7, borderTop: '0.5px solid #e2e8f0', paddingTop: 10 }}>
        閱讀說明：360° 回饋反映「他人觀察到的行為頻率與感受」，不是能力的絕對評定；評分者人數少時，單一評分者的影響較大，
        其中「主管」類只有一位評分者時，其看法即為該評分。報告中評分者以類別呈現，不列姓名。
        他評分數的「等級」門檻是依本題庫總分比例推算的暫定值，僅供對話參考。
      </div>
      <PageFooter label="本報告屬機密文件，僅限受評者及授權主管、教練閱覽" />
    </div>
  );
}

/**
 * 360° 完整報告（列印／存為 PDF）。自己用 rateeId／assessmentId 載入該受評者的全部作答。
 * 只支援非嚴格隱私的 360° 題庫（領導力羅盤有專屬的匿名化報告）。
 */
export default function ThreeSixtyReport({ rateeId, rateeName, assessmentId, onClose, groupName }) {
  const config = getAssessment(assessmentId);
  const filename = reportFilename({ kind: REPORT_KIND.threeSixty, assessmentId, groupName, subject: rateeName });
  const print = useReportFilename(filename);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');
  const mobile = useIsMobile();
  const [showA4, setShowA4] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => {
    let active = true;
    api.rateeSubmissions(rateeId, assessmentId)
      .then((list) => active && setSubs(list))
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, [rateeId, assessmentId]);

  const report = useMemo(() => (subs ? build360Report(subs, config) : null), [subs, config]);
  const date = formatDate(new Date().toISOString());
  const portal = document.getElementById('report-portal');
  if (!portal) return null;

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>360° 完整回饋報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{rateeName}</span>
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 10 }}>存檔檔名：{filename}.pdf</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={print} disabled={!report} style={{ background: '#1f5d4a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: report ? 1 : 0.5 }}>🖨️ 列印 / 存為 PDF</button>
          {mobile && report && (
            <button onClick={() => setShowA4((v) => !v)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{showA4 ? '看閱讀版' : '看 A4 原版'}</button>
          )}
          <button onClick={onClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✕ 關閉</button>
        </div>
      </div>
      {mobile && report && (
        <div className={`report-read ${showA4 ? 'report-read-hidden' : ''}`}>
          <ThreeSixtyReadView report={report} name={rateeName} date={date} />
        </div>
      )}
      <div className={`report-flow ${mobile && report ? 'report-a4' : ''} ${mobile && report && !showA4 ? 'report-a4-hidden' : ''}`} style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
        {error && <p style={{ padding: 40, color: '#dc2626' }}>{error}</p>}
        {!error && subs === null && <p style={{ padding: 40, color: '#64748b' }}>載入 360° 資料中…</p>}
        {subs !== null && !report && <p style={{ padding: 40, color: '#64748b' }}>這位受評者還沒有可用的評測資料。</p>}
        {report && (
          <>
            <Cover r={report} name={rateeName} date={date} />
            <Contents r={report} />
            <Framework r={report} />
            <Overall r={report} />
            <Compare r={report} />
            <SubRankingSection r={report} />
            <DimensionDetails r={report} />
            <PlanPage r={report} />
          </>
        )}
      </div>
    </>,
    portal,
  );
}
