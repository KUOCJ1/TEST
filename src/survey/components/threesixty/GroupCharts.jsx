// 360° 報告的圖表：參考區間帶、子能力排名、構面與子能力的評分者群組橫條、目錄與圖例。
// 版面與配色是我們自己的：群組用中文名稱與固定顏色，分數 1–5 畫在同一把尺上，
// 「穩定展現區間」（3.5–4.5，子能力語句的「中」段）畫成底色帶；群組間落差過大（構面 ≥ 1.0、子能力 ≥ 1.5）標紅色雙向箭頭。
import { REF_BAND, GROUP_GAP_DIM, GROUP_GAP_SUB } from '../../utils/report360.js';

import { GROUPS, GROUP_ORDER } from './groups.js';
const f1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
const pos = (v) => `${Math.max(0, Math.min(100, ((v - 1) / 4) * 100))}%`;
const bandStyle = { position: 'absolute', top: 0, bottom: 0, left: pos(REF_BAND.min), width: `${((REF_BAND.max - REF_BAND.min) / 4) * 100}%`, background: '#e2e8f0', opacity: 0.75 };

/** 1–5 的刻度列（對齊下面各列的橫條區）。 */
function Axis({ labels = [], offset = 0 }) {
  return (
    <div style={{ position: 'relative', height: 22, fontSize: 8.5, color: '#64748b', marginLeft: offset }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ position: 'absolute', left: pos(n), transform: n === 1 ? 'none' : n === 5 ? 'translateX(-100%)' : 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
          <b style={{ fontSize: 10, color: '#334155' }}>{n}</b>
          {labels[n - 1] && <div style={{ fontSize: 7.5 }}>{labels[n - 1]}</div>}
        </div>
      ))}
    </div>
  );
}

/** 一條橫條：底色帶 + 橫條 + 分數。 */
function Bar({ value, color, height = 12, bold, label }) {
  return (
    <div style={{ position: 'relative', height, background: '#f8fafc', borderRadius: 3, overflow: 'hidden' }} role="img" aria-label={`${label ?? ''} ${f1(value)}`}>
      <div style={bandStyle} />
      {typeof value === 'number' && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pos(value), background: color, borderRadius: 3 }} />}
      {typeof value === 'number' && (
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: pos(value), marginLeft: 4, display: 'flex', alignItems: 'center', fontSize: Math.min(9.5, height - 1), fontWeight: bold ? 800 : 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{f1(value)}</span>
      )}
    </div>
  );
}

/** 落差箭頭（紅色雙向箭頭）。 */
function GapArrow({ spread, title }) {
  return <span title={title} style={{ color: '#dc2626', fontWeight: 800, fontSize: 12, lineHeight: 1 }} aria-label={`群組間落差 ${spread}`}>↕</span>;
}

/** 圖例：群組顏色、穩定展現區間、落差箭頭。 */
function Legend({ counts = {}, hasPeer }) {
  const items = GROUP_ORDER.filter((g) => g !== 'peer' || hasPeer);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 9, color: '#475569', alignItems: 'center', marginBottom: 6 }}>
      {items.map((g) => (
        <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: GROUPS[g].color, display: 'inline-block' }} />
          {GROUPS[g].label}{counts[g] ? `（${counts[g]} 位）` : ''}
        </span>
      ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 18, height: 10, background: '#e2e8f0', display: 'inline-block' }} />穩定展現區間 {REF_BAND.min}–{REF_BAND.max}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span aria-hidden="true" style={{ color: '#dc2626', fontWeight: 800, fontSize: 12, lineHeight: 1 }}>↕</span> 群組間差距 ≥ {GROUP_GAP_DIM.toFixed(1)}（構面）／{GROUP_GAP_SUB.toFixed(1)}（子能力）</span>
    </div>
  );
}

/** 子能力排名：依他人眼中的分數（沒有他評時用自評）由高到低，分成「穩定展現以上」與「有發展機會」兩區。 */
export function SubRanking({ r, labels }) {
  const rk = r.subRanking;
  if (!rk || rk.all.length === 0) return null;
  const basis = r.basis === 'others' ? '他人眼中' : '自評';
  const row = (s) => (
    <div key={`${s.dimId}-${s.id}`} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', alignItems: 'center', gap: 8, padding: '2.5px 0', breakInside: 'avoid' }}>
      <div style={{ fontSize: 10.5, color: '#0f172a', fontWeight: 600, lineHeight: 1.25 }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: s.color, marginRight: 5 }} />{s.name}
        <div style={{ fontSize: 8, color: '#94a3b8', marginLeft: 12, fontWeight: 400 }}>{s.dimName}</div>
      </div>
      <Bar value={s.value} color={s.band === 'low' ? '#dc2626' : s.band === 'high' ? '#059669' : '#0e7490'} height={13} bold label={s.name} />
      <div style={{ fontSize: 8.5, color: '#64748b', textAlign: 'right' }}>{r.basis === 'others' && typeof s.self === 'number' ? `自評 ${f1(s.self)}` : ''}</div>
    </div>
  );
  const group = (title, note, list, empty) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', margin: '8px 0 2px', breakAfter: 'avoid' }}>{title}</div>
      <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4, breakAfter: 'avoid' }}>{note}</div>
      {list.length ? list.map(row) : <div style={{ fontSize: 10, color: '#94a3b8' }}>{empty}</div>}
    </div>
  );
  return (
    <div id="chart-sub-ranking">
      <Legend counts={r.counts} hasPeer={r.counts.peer > 0} />
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 8 }}><div /><Axis labels={labels} /><div /></div>
      {group(`穩定展現以上（${basis} ≥ ${rk.band.min}）`, `${rk.strengths.length} 項：落在穩定展現區間內或以上；綠色為 ≥ ${rk.band.max} 的優秀表現。`, rk.strengths, '沒有子能力達到這個水準。')}
      {group(`有發展機會（${basis} < ${rk.band.min}）`, `${rk.opportunities.length} 項：低於穩定展現區間，是優先投入的練習方向。`, rk.opportunities, '沒有低於 3.5 的子能力。')}
    </div>
  );
}

/** 構面 × 評分者群組：每個構面一組橫條（自評、主管、同儕、部屬、他評合計）。 */
export function DimGroupBars({ r, labels, kindInfo }) {
  return (
    <div id="chart-dim-groups">
      <Legend counts={r.counts} hasPeer={r.counts.peer > 0} />
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 18px', gap: 8 }}><div /><Axis labels={labels} offset={56} /><div /></div>
      {r.dimensions.map((d) => (
        <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 18px', gap: 8, padding: '7px 0', borderTop: '0.5px solid #e2e8f0', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 5 }} />{d.name}</div>
            {d.kind !== 'aligned' && d.kind !== 'unknown' && <div style={{ fontSize: 8.5, fontWeight: 700, color: kindInfo[d.kind].color, marginTop: 2 }}>{kindInfo[d.kind].label}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {GROUP_ORDER.filter((g) => typeof d[g] === 'number').map((g) => (
              <div key={g} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 8.5, color: GROUPS[g].color, fontWeight: 700 }}>{GROUPS[g].label}</span>
                <Bar value={d[g]} color={GROUPS[g].color} bold={g === 'others'} label={`${d.name}${GROUPS[g].label}`} />
              </div>
            ))}
          </div>
          <div style={{ alignSelf: 'center' }}>{d.wideSpread && <GapArrow spread={d.spread} title={`評分者群組間最大差距 ${d.spread}`} />}</div>
        </div>
      ))}
    </div>
  );
}

/** 一個構面底下各子能力的評分者群組橫條（細線版）。 */
export function SubGroupBars({ dim, labels }) {
  if (!dim.subs.length) return null;
  return (
    <div id={`sub-groups-${dim.id}`} style={{ marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 18px', gap: 8 }}><div /><Axis labels={labels} offset={52} /><div /></div>
      {dim.subs.map((s) => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 18px', gap: 8, padding: '5px 0', borderTop: '0.5px solid #f1f5f9', breakInside: 'avoid' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>{s.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {GROUP_ORDER.filter((g) => typeof (g === 'others' ? s.others : s[g]) === 'number').map((g) => (
              <div key={g} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 8, color: GROUPS[g].color, fontWeight: 700 }}>{GROUPS[g].label}</span>
                <Bar value={g === 'others' ? s.others : s[g]} color={GROUPS[g].color} height={8} bold={g === 'others'} label={`${s.name}${GROUPS[g].label}`} />
              </div>
            ))}
          </div>
          <div style={{ alignSelf: 'center' }}>{s.wideSpread && <GapArrow spread={s.spread} title={`評分者群組間最大差距 ${s.spread}`} />}</div>
        </div>
      ))}
    </div>
  );
}

/** 報告目錄與閱讀指引（沒有頁碼：連續排版的頁數會隨內容變動）。 */
export function Contents({ r }) {
  const items = [
    ['評量項目與定義', '這份報告評量哪些構面、各構面的定義與子能力。'],
    ['評估方式', '誰來評分、分數怎麼算、等級與差距怎麼看。'],
    ['整體評價', '他人眼中的強項與優先發展、自評與他評的盲點與被低估的優勢。'],
    ['各構面：自評與各類評分者', '雷達圖，以及每個構面各類評分者的橫條比較。'],
    ['子能力排名', `${r.subRanking?.all.length ?? 0} 個子能力由高到低，分成穩定展現以上與有發展機會。`],
    ['構面與子能力詳述', '各構面的評語，與每個子能力各類評分者的橫條。'],
    ...(r.insights?.length ? [['構面落差提示', '兩個構面分數形成特定組合時的說明與建議學習方向。']] : []),
    ['發展建議與討論題', '近、中、長期的行動建議，以及面談時可以討論的問題。'],
  ];
  return (
    <div style={{ marginTop: 26, breakInside: 'avoid' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>報告目錄與閱讀指引</div>
      <ol style={{ margin: '8px 0 12px', paddingLeft: 20, fontSize: 10.5, lineHeight: 1.85, color: '#334155' }}>
        {items.map(([t, d]) => <li key={t}><b>{t}</b>：{d}</li>)}
      </ol>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 10, color: '#475569', lineHeight: 1.8 }}>
        <b style={{ color: '#0f172a' }}>怎麼讀圖：</b>橫條越長，分數越高（1–5 分同一把尺）；灰色底帶是「穩定展現區間」{REF_BAND.min}–{REF_BAND.max}，落在帶內或右側表示在多數情境穩定展現，落在左側表示有發展機會。
        每組橫條的顏色代表不同的評分者群組（自評、主管、同儕、部屬、他評合計）。紅色 ↕ 表示不同群組的看法差距很大（構面 ≥ {GROUP_GAP_DIM.toFixed(1)}、子能力 ≥ {GROUP_GAP_SUB.toFixed(1)}），值得優先討論。
        沒有人評分的群組不會畫出來。
      </div>
    </div>
  );
}
