// ─── Pages 5-7: Dimension detail by layer ──────────────────────
import { PageMeta, PageFooter } from './primitives.jsx';
import DimBlock from './DimBlock.jsx';

// startsPage=false 時接在前一個圈層後面連續排版（不另起新頁），避免每個圈層只佔半頁。
export default function LayerPage({ layer, result, benchmark, config, user, date, startsPage = true, isLast = true }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const layerDims = dimensions.filter((d) => layer.dimensions.includes(d.id));

  return (
    <div style={{ ...(startsPage ? { pageBreakBefore: 'always' } : { marginTop: 8 }), padding: startsPage ? '32px 52px 0' : '0 52px' }}>
      {startsPage && <PageMeta name={user?.name ?? '—'} section={layer.name} date={date} assessmentName={result?.assessmentName} />}
      {/* 圈層標題與第一個構面綁在一起，標題不會單獨落在頁尾 */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
          構面詳細分析 · {layer.name}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{layer.name}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{layer.desc}</div>
      </div>

      {layerDims.slice(0, 1).map((d) => {
        const bd = dimAvgs?.find((b) => b.id === d.id);
        return <DimBlock key={d.id} dim={d} benchPct={bd?.percent ?? null} config={config} />;
      })}
      </div>

      {layerDims.slice(1).map((d) => {
        const bd = dimAvgs?.find((b) => b.id === d.id);
        return <DimBlock key={d.id} dim={d} benchPct={bd?.percent ?? null} config={config} />;
      })}

      {isLast && <PageFooter />}
    </div>
  );
}
