import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { getAssessment } from '../data/assessments/index.js';
import { computePercentile } from '../utils/analytics';
import { formatDate } from '../utils/format';

// PrintableReport 的每一頁都是各自獨立、可單獨測試的子元件（見
// components/printable-report/），這支檔案只負責依題庫設定組裝頁面順序，以及
// 印刷用的外層 portal + 工具列。拆分前這支檔案曾長達 1100+ 行，拆分後每個頁面
// 元件都在 200 行以內，共用的設計 token／輔助函式／基礎元件也各自獨立成檔，
// 方便日後單獨調整某一頁而不用在整份巨型檔案裡定位。
import CoverPage from './printable-report/CoverPage.jsx';
import ReadingGuidePage from './printable-report/ReadingGuidePage.jsx';
import ExecutiveSummaryPage from './printable-report/ExecutiveSummaryPage.jsx';
import OverviewPage from './printable-report/OverviewPage.jsx';
import QuadrantPage from './printable-report/QuadrantPage.jsx';
import LayerPage from './printable-report/LayerPage.jsx';
import CoachPage from './printable-report/CoachPage.jsx';
import DevPlanPage from './printable-report/DevPlanPage.jsx';

// ─── Report body (reusable — single member or part of a batch run) ──────
export function ReportPages({ result, benchmark, user, submittedAt, comments = [] }) {
  const config = getAssessment(result.assessmentId);
  const percentile = benchmark?.totals?.length >= 2
    ? computePercentile(result.total, benchmark.totals)
    : null;
  const date = formatDate(submittedAt);
  const hasSubs = result.dimensions?.some((d) => d.subs?.length > 0);
  const showNarrative = !!(config?.COMMENTARY && hasSubs);
  const layers = config?.LAYERS ?? null;

  return (
    <div style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
      <CoverPage result={result} user={user} submittedAt={submittedAt} benchmark={benchmark} percentile={percentile} />
      <ReadingGuidePage user={user} date={date} config={config} result={result} hasSubs={hasSubs} />
      {showNarrative && <ExecutiveSummaryPage result={result} benchmark={benchmark} config={config} user={user} date={date} />}
      <OverviewPage result={result} benchmark={benchmark} user={user} date={date} />
      {hasSubs && <QuadrantPage result={result} benchmark={benchmark} user={user} date={date} />}
      {layers
        ? layers.map((layer) => (
            <LayerPage key={layer.id} layer={layer} result={result} benchmark={benchmark} config={config} user={user} date={date} />
          ))
        : <LayerPage layer={{ id: 'all', name: '構面詳細分析', desc: '', dimensions: result.dimensions.map((d) => d.id) }} result={result} benchmark={benchmark} config={config} user={user} date={date} />
      }
      {(showNarrative || comments.length > 0) && <CoachPage result={result} config={config} user={user} date={date} comments={comments} />}
      {showNarrative && <DevPlanPage result={result} config={config} user={user} date={date} />}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────
export default function PrintableReport({ result, benchmark, user, submittedAt, onClose, comments = [] }) {
  const percentile = benchmark?.totals?.length >= 2
    ? computePercentile(result.total, benchmark.totals)
    : null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const portal = document.getElementById('report-portal');
  if (!portal) return null;

  return createPortal(
    <>
      {/* Toolbar — hidden on print */}
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>個人評測報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{result.assessmentName}</span>
          {percentile != null && (
            <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 10 }}>
              · 超越 {percentile}% 填答者
            </span>
          )}
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

      <ReportPages result={result} benchmark={benchmark} user={user} submittedAt={submittedAt} comments={comments} />
    </>,
    portal,
  );
}
