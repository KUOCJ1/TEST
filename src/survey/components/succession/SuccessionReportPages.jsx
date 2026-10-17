import { formatDate } from '../../utils/format';
import { HBar, PageMeta, PageFooter, SectionTitle } from '../printable-report/primitives.jsx';
import { SUCCESSION_READING, SUCCESSION_TEXT } from '../../utils/successionText.js';

/** 接班補充問卷的列印版（一頁）。沒有總分、排名與比較。 */
export default function SuccessionReportPages({ result, user, submittedAt }) {
  const date = formatDate(submittedAt);
  return (
    <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="接班想法" date={date} assessmentName={result.assessmentName} />
      <SectionTitle sub="用來支持發展對話，不是評分">接班補充問卷</SectionTitle>
      <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 10.5, color: '#475569', lineHeight: 1.9 }}>
        {SUCCESSION_READING.map((t) => <li key={t}>{t}</li>)}
      </ul>
      {result.dimensions.map((d) => (
        <div key={d.id} style={{ marginBottom: 14, breakInside: 'avoid' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
            <span>{d.name}<span style={{ fontSize: 9, fontWeight: 400, color: '#64748b', marginLeft: 6 }}>{d.subtitle}</span></span>
            {d.answered > 0 && <span style={{ fontSize: 10, color: '#584419' }}>傾向{d.rating.label}</span>}
          </div>
          {d.answered > 0 ? (
            <>
              <div style={{ margin: '5px 0' }}><HBar userPct={d.percent} color={d.color} height={8} /></div>
              <div style={{ fontSize: 10.5, color: '#334155', lineHeight: 1.85 }}>{SUCCESSION_TEXT[d.id]?.[d.stance]}</div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>受測者選擇不回答這個面向，故不顯示內容。</div>
          )}
        </div>
      ))}
      <PageFooter label="本報告屬機密文件，僅限受測者、所屬班級教練與平台管理員閱覽" />
    </div>
  );
}
