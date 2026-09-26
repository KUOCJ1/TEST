import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';

// 後端只回傳 id，這裡換成題庫／構面的中文名稱（Sprint 8：以前直接顯示
// ai-competency、workflow 這種內部代碼）。對不到的舊 id 退回原樣，不會空白。
const assessmentLabel = (id) => getAssessment(id)?.NAME ?? id;
const dimensionLabel = (assessmentId, dimensionId) =>
  getAssessment(assessmentId)?.DIMENSIONS?.find((d) => d.id === dimensionId)?.name ?? dimensionId;

/**
 * 延伸閱讀使用情形（Sprint 3 驗收條件 3.6）：依題庫＋構面彙總點擊數與加入清單
 * 數，只有彙總數字，不含任何個人身分——個人的閱讀紀錄與學習清單設計上只有
 * 本人看得到（見 GoalPanel.jsx／LearningResources.jsx 的隱私設計），管理者
 * 這裡看不到「誰讀了什麼」，只看得到「哪個主題被點得多、被存得多」。
 * 自己抓自己的資料，不吃 AnalyticsTab 既有的 submissions/users props——那些是
 * 另一個維度（作答成績）的資料，硬塞進同一份 props 反而混淆兩件不相關的事。
 */
export default function LearningResourceStatsPanel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.adminLearningResourceStats()
      .then((list) => active && setStats(list))
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  return (
    <section className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <BookOpen className="h-4 w-4 text-brass-500" /> 延伸閱讀使用情形
      </h3>
      <p className="mb-4 text-xs text-slate-400">依題庫＋構面彙總，只有次數，不含個人身分。</p>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && stats === null && <p className="text-sm text-slate-400">載入中…</p>}
      {stats && stats.length === 0 && (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          目前還沒有任何點擊或加入清單的紀錄。
        </p>
      )}
      {stats && stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 text-left font-medium">題庫</th>
                <th className="py-2 pr-4 text-left font-medium">構面</th>
                <th className="py-2 pr-4 text-right font-medium">點擊數</th>
                <th className="py-2 text-right font-medium">加入清單數</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={`${row.assessmentId}::${row.dimensionId}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 text-slate-600">{assessmentLabel(row.assessmentId)}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{dimensionLabel(row.assessmentId, row.dimensionId)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-slate-700">{row.clicks}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-700">{row.saves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
