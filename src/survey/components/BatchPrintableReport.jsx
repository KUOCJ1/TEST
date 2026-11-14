import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { ReportPages } from './PrintableReport';
import { reportFilename, REPORT_KIND } from '../utils/reportFilename.js';
import { useReportFilename } from '../hooks/useReportFilename.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { BatchReadView } from './MobileReportViews.jsx';
import { useState } from 'react';

/**
 * 整班批次匯出：把每位成員的個人報告接續排版成同一份文件，一次列印／存為 PDF，
 * 不必逐一開啟→列印→關閉重複十幾次（對應 C-05）。每人之間強制分頁，避免上一位
 * 報告的最後一頁跟下一位的封面頁擠在同一張紙上。
 */
export default function BatchPrintableReport({ members, benchmark, onClose, groupName }) {
  const filename = reportFilename({ kind: REPORT_KIND.batch, assessmentId: members[0]?.submission?.result?.assessmentId, groupName, detail: `${members.length}人` });
  const print = useReportFilename(filename);
  const mobile = useIsMobile();
  const [showA4, setShowA4] = useState(false);
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
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 10 }}>存檔檔名：{filename}.pdf</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={print}
            style={{ background: '#1f5d4a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ 全部列印 / 存為 PDF
          </button>
          {mobile && (
            <button
              onClick={() => setShowA4((v) => !v)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {showA4 ? '看閱讀版' : '看 A4 原版'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ 關閉
          </button>
        </div>
      </div>

      {mobile && (
        <div className={`report-read ${showA4 ? 'report-read-hidden' : ''}`}>
          <BatchReadView members={members} benchmark={benchmark} />
        </div>
      )}
      <div className={mobile ? `report-a4 ${showA4 ? '' : 'report-a4-hidden'}` : undefined}>
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
      </div>
    </>,
    portal,
  );
}
