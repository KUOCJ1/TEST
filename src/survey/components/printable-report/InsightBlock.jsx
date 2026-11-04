// 構面落差提示區塊（個人報告與 360° 報告共用）：說明＋建議課程。
export default function InsightBlock({ insights }) {
  if (!insights?.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>構面落差提示</div>
      {insights.map((it) => (
        <div key={it.id} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '14px 16px', pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>{it.title}</div>
          <div style={{ fontSize: 11, lineHeight: 1.85, color: '#334155', marginBottom: 10 }}>{it.text}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>建議的學習方向</div>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 10.5, lineHeight: 1.75, color: '#334155' }}>
            {it.courses.map((c) => <li key={c.name}><b>{c.name}</b>：{c.purpose}（{c.activity}）</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
