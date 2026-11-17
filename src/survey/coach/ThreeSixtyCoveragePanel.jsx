import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import BatchThreeSixtyReport from '../components/BatchThreeSixtyReport.jsx';
import { GROUP_MIN, COVERAGE_TYPES, buildCoverage } from '../utils/coverage360.js';

// 360° 他評收齊清單（Sprint 27）：每位受評者的自評狀態與各類評分者人數。只有人數，沒有評分者身分。
// 同儕／部屬少於 3 位標示「未達匿名門檻」（單一評分者的看法會被當成整類的看法）；主管通常只有 1 位，不算不足。
export default function ThreeSixtyCoveragePanel({ group, memberRows, mailConfigured, showToast }) {
  const config = getAssessment(group.assessmentId);
  const enabled = !!config?.SUPPORTS_360 && !config?.STRICT_RATER_PRIVACY;
  const rows = useMemo(() => buildCoverage(memberRows), [memberRows]);
  const [batch, setBatch] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!enabled || rows.length === 0) return null;

  const needMore = rows.filter((r) => r.none || r.low.length > 0).length;
  const openBatch = () => {
    api.logReportExport(group.id, rows.length).catch(() => {});
    setBatch(true);
  };
  const remind = async () => {
    setBusy(true);
    try {
      const r = await api.remindGroupRaters(group.id);
      showToast?.(r.sent > 0 ? `已提醒 ${r.sent} 位尚未完成的評分者` : '目前沒有需要提醒的評分者');
    } catch (e) {
      showToast?.(e.message || '寄送失敗', 'error');
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="360° 他評收齊狀況" className="panel">
      <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700"><Users className="h-4 w-4 text-ink-700" /> 360° 他評收齊狀況</h3>
      <p className="mb-3 text-xs text-slate-500">
        每位受評者目前收到幾位評分者的回饋（只有人數，不顯示評分者身分）。同儕、部屬少於 {GROUP_MIN} 位時，個別看法容易被當成整類的看法，建議補齊再出報告。
        {needMore > 0 ? ` 目前有 ${needMore} 位受評者還需要補評分。` : ' 全部受評者都已收齊。'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-3 font-medium">受評者</th>
            {COVERAGE_TYPES.map(([id, label]) => <th key={id} className="py-2 pr-3 font-medium">{label}</th>)}
            <th className="py-2 font-medium">狀態</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-slate-700">{r.name}</td>
                {COVERAGE_TYPES.map(([id]) => <td key={id} className="py-2 pr-3 text-slate-600">{r.counts[id]}</td>)}
                <td className="py-2 text-xs font-semibold">
                  {r.none ? <span className="text-red-600">尚無他評</span>
                    : r.short ? <span className="text-amber-700">他評共 {r.total} 位，未達 {GROUP_MIN} 位（報告暫不顯示他評）</span>
                    : r.low.length > 0 ? <span className="text-amber-700">{r.low.map((t) => (t === 'peer' ? '同儕' : '部屬')).join('、')}未達 {GROUP_MIN} 位</span>
                      : <span className="text-emerald-700">已收齊</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={openBatch} className="btn-primary btn-sm">批次產出 360° 報告</button>
        <button type="button" onClick={remind} disabled={busy || !mailConfigured} className="btn-secondary btn-sm">提醒尚未完成的評分者</button>
        <span className="text-xs text-slate-400">{!mailConfigured ? '尚未設定寄信服務（SMTP），無法寄送提醒。' : '提醒只會寄給「已被邀請、還沒完成」的人；你看不到是哪幾位；同班 1 小時只能寄一次。'}</span>
      </div>
      {batch && <BatchThreeSixtyReport ratees={rows.map((r) => ({ id: r.id, name: r.name }))} assessmentId={group.assessmentId} groupName={group.name} onClose={() => setBatch(false)} />}
    </section>
  );
}
