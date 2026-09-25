// ─── Pages 5-7: Dimension detail by layer ──────────────────────
import { PageMeta, PageFooter } from './primitives.jsx';
import DimBlock from './DimBlock.jsx';

export default function LayerPage({ layer, result, benchmark, config, user, date }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const layerDims = dimensions.filter((d) => layer.dimensions.includes(d.id));

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section={layer.name} date={date} assessmentName={result?.assessmentName} />
      {/* Layer header */}
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
          構面詳細分析 · {layer.name}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{layer.name}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{layer.desc}</div>
      </div>

      {layerDims.map((d) => {
        const bd = dimAvgs?.find((b) => b.id === d.id);
        return (
          <DimBlock key={d.id} dim={d} benchPct={bd?.percent ?? null} config={config} />
        );
      })}

      <PageFooter />
    </div>
  );
}
