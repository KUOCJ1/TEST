import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { build360Report } from '../utils/report360.js';
import { formatDate } from '../utils/format';
import { reportFilename, REPORT_KIND } from '../utils/reportFilename.js';
import { useReportFilename } from '../hooks/useReportFilename.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { ThreeSixtyBody } from './ThreeSixtyReport.jsx';
import { ThreeSixtyReadView } from './MobileReportViews.jsx';

// 整班 360° 批次報告（Sprint 27）：把每位受評者的 360° 完整報告接在同一份文件，每人之間換頁，
// 一次列印／存為 PDF。資料逐位載入（一次一位，避免同時打爆伺服器）；沒有任何作答資料的受評者不放進文件，
// 並在螢幕上的提醒列說明少了誰（提醒列不列印）。
const CONCURRENCY = 3;

export default function BatchThreeSixtyReport({ ratees, assessmentId, groupName, onClose }) {
  const config = getAssessment(assessmentId);
  const filename = reportFilename({ kind: REPORT_KIND.threeSixty, assessmentId, groupName, detail: `批次${ratees.length}人` });
  const print = useReportFilename(filename);
  const mobile = useIsMobile();
  const [showA4, setShowA4] = useState(false);
  const [loaded, setLoaded] = useState({}); // id → submissions | { error }
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let active = true;
    const queue = [...ratees];
    const worker = async () => {
      while (active && queue.length) {
        const r = queue.shift();
        try {
          const subs = await api.rateeSubmissions(r.id, assessmentId);
          if (active) setLoaded((prev) => ({ ...prev, [r.id]: subs }));
        } catch (e) {
          if (active) setLoaded((prev) => ({ ...prev, [r.id]: { error: e.message || '載入失敗' } }));
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(CONCURRENCY, ratees.length) }, worker));
    return () => { active = false; };
  }, [ratees, assessmentId]);

  const items = useMemo(() => ratees.map((r) => {
    const v = loaded[r.id];
    if (v === undefined) return { ...r, state: 'loading' };
    if (v?.error) return { ...r, state: 'error', error: v.error };
    const report = build360Report(v, config);
    return report ? { ...r, state: 'ok', report } : { ...r, state: 'empty' };
  }), [ratees, loaded, config]);

  const done = items.filter((i) => i.state !== 'loading').length;
  const ready = items.filter((i) => i.state === 'ok');
  const skipped = items.filter((i) => i.state === 'empty' || i.state === 'error');
  const loading = done < items.length;
  const date = formatDate(new Date().toISOString());

  const portal = document.getElementById('report-portal');
  if (!portal) return null;
  const btn = { background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' };

  return createPortal(
    <>
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>360° 批次報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{loading ? `載入中 ${done}／${items.length}` : `共 ${ready.length} 份`}</span>
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 10 }}>存檔檔名：{filename}.pdf</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={print} disabled={loading || ready.length === 0} style={{ background: '#1f5d4a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading || ready.length === 0 ? 0.5 : 1 }}>🖨️ 全部列印 / 存為 PDF</button>
          {mobile && <button onClick={() => setShowA4((v) => !v)} style={btn}>{showA4 ? '看閱讀版' : '看 A4 原版'}</button>}
          <button onClick={onClose} style={{ ...btn, color: 'rgba(255,255,255,0.7)' }}>✕ 關閉</button>
        </div>
      </div>

      {mobile && (
        <div className={`report-read ${showA4 ? 'report-read-hidden' : ''}`}>
          <div className="px-4 pb-8 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">360° 批次報告</p>
            <h2 className="mt-0.5 text-xl font-extrabold text-slate-800">{groupName}</h2>
            <p className="mb-3 mt-1 text-sm text-slate-500">點選受評者展開報告；整批列印請用上方按鈕（印出的是 A4 版）。</p>
            {skipped.length > 0 && <p role="note" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{skipped.length} 位受評者沒有可用資料，未放進文件。</p>}
            <ol className="space-y-2">
              {ready.map((i) => (
                <li key={i.id} className="rounded-xl border border-slate-100 bg-white">
                  <button type="button" aria-expanded={openId === i.id} onClick={() => setOpenId(openId === i.id ? null : i.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <span className="font-semibold text-slate-800">{i.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-ink-700">{openId === i.id ? '收合' : '展開'}</span>
                  </button>
                  {openId === i.id && <div className="border-t border-slate-100"><ThreeSixtyReadView report={i.report} name={i.name} date={date} /></div>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className={mobile ? `report-a4 ${showA4 ? '' : 'report-a4-hidden'}` : undefined} style={{ background: '#fff', fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
        {/* 螢幕上的提醒列（不列印）：少了誰、為什麼。 */}
        {!loading && skipped.length > 0 && (
          <div className="print:hidden" role="note" style={{ margin: '16px 40px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.7 }}>
            有 {skipped.length} 位受評者沒有可用資料，未放進這份文件：{skipped.map((s) => s.name).join('、')}。
          </div>
        )}
        {loading && <p style={{ padding: 40, color: '#64748b' }}>載入 360° 資料中（{done}／{items.length}）…</p>}
        {ready.map((i, idx) => (
          <div key={i.id} style={{ pageBreakBefore: idx === 0 ? 'auto' : 'always', padding: '28px 40px 36px' }}>
            <ThreeSixtyBody report={i.report} name={i.name} date={date} />
          </div>
        ))}
      </div>
    </>,
    portal,
  );
}
