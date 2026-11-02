import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { build360Report } from '../utils/report360.js';
import { RATER_LABELS } from '../constants/raterTypes';
import { formatDate } from '../utils/format';
import RadarChart from './RadarChart';
import { TONE_COLOR } from './printable-report/tokens.js';
import { toneOf } from './printable-report/helpers.js';
import { PageMeta, PageFooter, SectionTitle } from './printable-report/primitives.jsx';

// 360° 完整報告（列印／存為 PDF）：封面、整體評價、自評 vs 他評、各構面與子能力、發展建議與討論。
// 資料整理在 utils/report360.js；這裡只負責版面。評分者只以「類別」呈現（主管／同儕／部屬），不列姓名。

const PAGE = { pageBreakAfter: 'always', padding: '32px 52px' };
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
    <div style={{ pageBreakAfter: 'always' }}>
      <div style={{ background: '#241f18', padding: '44px 52px 38px', color: '#fff' }}>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', marginBottom: 10 }}>CONFIDENTIAL · 360° FEEDBACK REPORT</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>{r.assessmentName}<br /><span style={{ fontSize: 20, fontWeight: 600, opacity: 0.85 }}>360° 完整回饋報告</span></div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>報告日期 {date}</div>
      </div>
      <div style={{ padding: '28px 52px 0' }}>
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
      <PageFooter />
    </div>
  );
}

function Overall({ r, name, date }) {
  const basisNote = r.basis === 'others' ? '以下的強項與發展方向，以「他人眼中」的分數為依據。' : '目前沒有他評，以下以自評為依據。';
  return (
    <div style={PAGE}>
      <PageMeta reportLabel="360° 回饋報告" name={name} section="整體評價" date={date} assessmentName={r.assessmentName} />
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
      <PageFooter />
    </div>
  );
}

function Compare({ r, name, date }) {
  const dims = r.dimensions;
  const pct = (v) => (typeof v === 'number' ? Math.round((v / 5) * 100) : 0);
  const radarSelf = dims.map((d) => ({ id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, percent: pct(d.self ?? d.others) }));
  const radarCompare = r.hasSelf && r.hasOthers ? dims.map((d) => ({ id: d.id, percent: pct(d.others) })) : null;
  const cols = ['self', 'manager', 'peer', 'subordinate', 'others'];
  const head = { self: '自評', manager: '主管', peer: '同儕', subordinate: '部屬', others: '他評合計' };
  return (
    <div style={PAGE}>
      <PageMeta reportLabel="360° 回饋報告" name={name} section="自評 vs 他評" date={date} assessmentName={r.assessmentName} />
      <SectionTitle sub="分數為 1–5 的平均；同一類評分者取平均，「他評合計」為所有他評評分者的平均">各構面：自評與各類評分者</SectionTitle>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <RadarChart dimensions={radarSelf} compare={radarCompare} compareLabel="他評" size={250} />
      </div>
      {radarCompare && <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 9, color: '#64748b', marginBottom: 14 }}><span>━ 自評</span><span style={{ opacity: 0.65 }}>╌ 他評合計</span></div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#64748b' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>構面</th>
            {cols.map((c) => <th key={c} style={{ textAlign: 'center', padding: '6px 4px' }}>{head[c]}{c !== 'self' && c !== 'others' && r.counts[c] ? `（${r.counts[c]}）` : ''}</th>)}
            <th style={{ textAlign: 'center', padding: '6px 4px' }}>差距</th>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>觀察</th>
          </tr>
        </thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d.id} style={{ borderBottom: '0.5px solid #e2e8f0' }}>
              <td style={{ padding: '6px 4px', fontWeight: 700, color: '#334155' }}>{d.name}</td>
              {cols.map((c) => <td key={c} style={{ textAlign: 'center', padding: '6px 4px' }}><Score value={d[c]} bold={c === 'others'} /></td>)}
              <td style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700, color: d.gap == null ? '#cbd5e1' : KIND[d.kind].color }}>{d.gap == null ? '—' : signed(d.gap)}</td>
              <td style={{ padding: '6px 4px' }}>{d.kind !== 'aligned' && d.kind !== 'unknown' ? <Chip color={KIND[d.kind].color}>{KIND[d.kind].label}</Chip> : <span style={{ fontSize: 9, color: '#94a3b8' }}>{KIND[d.kind].label}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>分數顏色：≥4.2 精熟、≥3.4 熟練、≥2.6 發展中、≥1.8 萌芽。差距＝自評 − 他評合計。</div>
      <PageFooter />
    </div>
  );
}

function DimensionDetail({ r, name, date, dims, index }) {
  return (
    <div style={PAGE}>
      <PageMeta reportLabel="360° 回饋報告" name={name} section={`構面詳述 ${index}`} date={date} assessmentName={r.assessmentName} />
      {index === 1 && <SectionTitle sub="各構面的子能力得分、自評與他評對照，以及依他人眼中的表現整理的評語">構面與子能力詳述</SectionTitle>}
      {dims.map((d) => (
        <div key={d.id} style={{ pageBreakInside: 'avoid', marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 8 }} />{d.name}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>自評 <Score value={d.self} bold />&emsp;他評 <Score value={d.others} bold />{d.gap != null && d.kind !== 'aligned' && <> <Chip color={KIND[d.kind].color}>{KIND[d.kind].label} {signed(d.gap)}</Chip></>}</div>
          </div>
          {r.narratives[d.id] && <p style={{ fontSize: 11, lineHeight: 1.8, color: '#334155', margin: '0 0 10px' }}>{r.narratives[d.id]}</p>}
          {d.subs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead><tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}><th style={{ textAlign: 'left', padding: '4px' }}>子能力</th><th style={{ padding: '4px' }}>自評</th><th style={{ padding: '4px' }}>他評</th><th style={{ padding: '4px' }}>差距</th></tr></thead>
              <tbody>
                {d.subs.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                    <td style={{ padding: '4px', color: '#334155' }}>{s.name}</td>
                    <td style={{ textAlign: 'center', padding: '4px' }}><Score value={s.self} /></td>
                    <td style={{ textAlign: 'center', padding: '4px' }}><Score value={s.others} bold /></td>
                    <td style={{ textAlign: 'center', padding: '4px', fontWeight: 700, color: s.gap == null ? '#cbd5e1' : KIND[s.gap >= 0.5 ? 'blind' : s.gap <= -0.5 ? 'hidden' : 'aligned'].color }}>{s.gap == null ? '—' : signed(s.gap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <PageFooter />
    </div>
  );
}

function PlanPage({ r, name, date }) {
  const prompts = [];
  if (r.blind[0]) prompts.push(`在「${r.blind[0].name}」，您的自評（${f1(r.blind[0].self)}）高於他人的看法（${f1(r.blind[0].others)}）。您認為他人沒有感受到的是哪些行為？有沒有具體的情境可以回想？`);
  if (r.hidden[0]) prompts.push(`在「${r.hidden[0].name}」，他人（${f1(r.hidden[0].others)}）比您自己（${f1(r.hidden[0].self)}）看到更多優勢。這些行為您是怎麼做到的？可以怎麼更有意識地運用？`);
  if (r.develop[0]) prompts.push(`在「${r.develop[0].name}」，他人眼中的分數是 ${f1(r.develop[0].others ?? r.develop[0].self)}。您想先改變的一個具體行為是什麼？需要誰的支持？`);
  prompts.push('不同評分者（主管、同儕、部屬）的看法有哪些差異？背後可能的原因是什麼？');
  prompts.push('這份回饋中，最讓您意外的是哪一點？最想先採取的第一個行動是什麼？');
  return (
    <div style={PAGE}>
      <PageMeta reportLabel="360° 回饋報告" name={name} section="發展建議與討論" date={date} assessmentName={r.assessmentName} />
      <SectionTitle sub="依他人眼中的表現整理；可作為與受評者面談時的討論素材">發展建議</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
        {r.plan.map((p) => (
          <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', pageBreakInside: 'avoid' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#8a6a2f', marginBottom: 3 }}>{p.horizon}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{p.title}</div>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 11, lineHeight: 1.75, color: '#334155' }}>{p.actions.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        ))}
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
export default function ThreeSixtyReport({ rateeId, rateeName, assessmentId, onClose }) {
  const config = getAssessment(assessmentId);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');

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

  const pairs = [];
  if (report) for (let i = 0; i < report.dimensions.length; i += 2) pairs.push(report.dimensions.slice(i, i + 2));

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>360° 完整回饋報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{rateeName}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} disabled={!report} style={{ background: '#8a6a2f', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: report ? 1 : 0.5 }}>🖨️ 列印 / 存為 PDF</button>
          <button onClick={onClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✕ 關閉</button>
        </div>
      </div>
      <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
        {error && <p style={{ padding: 40, color: '#dc2626' }}>{error}</p>}
        {!error && subs === null && <p style={{ padding: 40, color: '#64748b' }}>載入 360° 資料中…</p>}
        {subs !== null && !report && <p style={{ padding: 40, color: '#64748b' }}>這位受評者還沒有可用的評測資料。</p>}
        {report && (
          <>
            <Cover r={report} name={rateeName} date={date} />
            <Overall r={report} name={rateeName} date={date} />
            <Compare r={report} name={rateeName} date={date} />
            {pairs.map((dims, i) => <DimensionDetail key={dims[0].id} r={report} name={rateeName} date={date} dims={dims} index={i + 1} />)}
            <PlanPage r={report} name={rateeName} date={date} />
          </>
        )}
      </div>
    </>,
    portal,
  );
}
