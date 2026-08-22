import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { ReportPages } from './PrintableReport';

/**
 * 整班批次匯出：把每位成員的個人報告接續排版成同一份文件，一次列印／存為 PDF，
 * 不必逐一開啟→列印→關閉重複十幾次（對應 C-05）。每人之間強制分頁，避免上一位
 * 報告的最後一頁跟下一位的封面頁擠在同一張紙上。
 */
export default function BatchPrintableReport({ members, benchmark, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const portal = document.getElementById('report-portal');
  if (!portal) return null;

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>整班個人報告（批次）</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>共 {members.length} 份</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#8a6a2f', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ 全部列印 / 存為 PDF
          </button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ 關閉
          </button>
        </div>
      </div>

      {members.map((m, i) => (
        <div key={m.submission.id} style={{ pageBreakBefore: i === 0 ? 'auto' : 'always' }}>
          <ReportPages
            result={m.submission.result}
            benchmark={benchmark}
            user={{ name: m.name, email: m.email }}
            submittedAt={m.submission.createdAt}
            comments={m.submission.comments}
          />
        </div>
      ))}
    </>,
    portal,
  );
}
