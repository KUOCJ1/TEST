import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { formatDate } from '../utils/format';
import { FULL_MIN, BASIC_MIN } from '../utils/compassGroup.js';
import { TENSION_TYPE_LABEL } from '../utils/compassText.js';
import { HBar, PageMeta, PageFooter, SectionTitle } from '../components/printable-report/primitives.jsx';

const pct = (avg) => Math.round((avg / 5) * 100);

/**
 * 領導力羅盤的班級組織診斷列印版。內容與畫面上的 CompassGroupReport 完全一致，
 * 並沿用同一份匿名分級（report.tier）：人數不足時列印出來也不會多出任何細節。
 */
export default function CompassGroupPrintable({ report, group, phaseLabel, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  const portal = document.getElementById('report-portal');
  if (!portal) return null;
  const date = formatDate(new Date().toISOString());

  return createPortal(
    <>
      <div className="report-toolbar">
        <div><span style={{ fontWeight: 700, fontSize: 14 }}>班級組織診斷報告</span><span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{group.name}</span></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={{ background: '#8a6a2f', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🖨️ 列印 / 存為 PDF</button>
          <button onClick={onClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✕ 關閉</button>
        </div>
      </div>
      <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', padding: '32px 52px' }}>
        <PageMeta name={group.name} section="組織診斷" date={date} assessmentName="領導力羅盤八向評測" />
        <SectionTitle sub={`${phaseLabel}，已完成自評 ${report.n} / ${report.memberCount} 人（${Math.round(report.completion * 100)}%）`}>班級組織診斷</SectionTitle>
        <p style={{ fontSize: 10, color: '#475569', lineHeight: 1.8, marginBottom: 16 }}>
          這份報告描述的是「這群人的行為模式」，不是組織文化的診斷結論，也不會顯示任何個人的分數。
          完成人數不足 {FULL_MIN} 位時只顯示平均（{BASIC_MIN}–{FULL_MIN - 1} 位）或完成率（少於 {BASIC_MIN} 位）。
        </p>

        {report.tier === 'hidden' && (
          <p style={{ fontSize: 11, color: '#475569' }}>完成人數少於 {BASIC_MIN} 位，暫不顯示分數與統計，以保護個人。</p>
        )}

        {report.tier !== 'hidden' && (
          <>
            {report.tier === 'basic' && <p style={{ fontSize: 10, color: '#584419', background: '#f6ecd7', padding: '6px 10px', borderRadius: 6 }}>樣本少，僅供參考；完成人數達 {FULL_MIN} 位才會顯示分布與張力。</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0 18px' }}>
              {report.loops.map((l) => (
                <div key={l.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 12 }}><span>{l.name}平均</span><span>{l.average.toFixed(1)}</span></div>
                  <div style={{ marginTop: 6 }}><HBar userPct={pct(l.average)} color="#2c5282" height={8} /></div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>八構面平均</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 22px', marginBottom: 20 }}>
              {report.dimensions.map((d) => (
                <div key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}><span>{d.name}</span><strong>{d.average.toFixed(1)}</strong></div>
                  <HBar userPct={pct(d.average)} color={d.color} height={8} />
                </div>
              ))}
            </div>
          </>
        )}

        {report.tier === 'full' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              {[['這群人最常展現', report.extremes.top], ['這群人相對較少展現', report.extremes.bottom]].map(([title, list]) => (
                <div key={title} style={{ background: '#f6ecd7', border: '1px solid #e9d3a0', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#584419' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                  {list.map((d) => <div key={d.id} style={{ fontWeight: 800 }}>{d.name} {d.average.toFixed(1)}</div>)}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>四組張力的取向分布</div>
            <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 8 }}>看的是這群人偏向哪一端、有多少人兼顧，不是分數高低。</div>
            {report.tensions.map((t) => (
              <div key={t.id} style={{ fontSize: 10.5, marginBottom: 8 }}>
                <strong>{t.nameA} ↔ {t.nameB}</strong>
                <span style={{ color: '#64748b', marginLeft: 8 }}>平均 {t.averageA?.toFixed(1) ?? '—'} ／ {t.averageB?.toFixed(1) ?? '—'}（{t.respondents} 人）</span>
                <div style={{ color: '#475569' }}>
                  {Object.entries(t.typeCounts).map(([type, c]) => {
                    const label = type === 'lean_a' ? `偏向${t.nameA}` : type === 'lean_b' ? `偏向${t.nameB}` : TENSION_TYPE_LABEL[type];
                    return `${label} ${c} 人`;
                  }).join('、') || '尚無資料'}
                </div>
              </div>
            ))}
          </>
        )}
        <PageFooter label="本報告屬機密文件，僅限教練與授權管理者閱覽；不含任何個人資料" />
      </div>
    </>,
    portal,
  );
}
