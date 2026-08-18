import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import { exportAdminCsv } from '../utils/csvExport';
import { useAssessmentFilter } from '../hooks/useAssessmentFilter';
import { api } from '../api/client';
import RadarChart from '../components/RadarChart';
import BarList from '../components/charts/BarList';
import LevelDistribution from '../components/charts/LevelDistribution';
import { formatDate } from '../utils/format';
import InfoTip from '../components/InfoTip';

function Kpi({ label, value, suffix, tip }) {
  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100">
      <p className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1 text-3xl font-extrabold text-slate-800">
        {value}
        {suffix && <span className="ml-1 text-base font-semibold text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

export default function AnalyticsTab({ submissions, users, adminAssessments, onAssessmentsChange }) {
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const initialId = adminAssessments[0]?.id ?? null;
  const { activeId: selectedId, setSelectedId, filtered: filteredSubs } =
    useAssessmentFilter(submissions, initialId);

  const activeConfig = useMemo(() => (selectedId ? getAssessment(selectedId) : null), [selectedId]);

  const stats = useMemo(
    () => (activeConfig ? aggregateStats(filteredSubs, activeConfig) : null),
    [filteredSubs, activeConfig],
  );

  const rows = useMemo(() => {
    if (!stats || !filteredSubs.length) return [];
    const latest = latestPerUser(filteredSubs);
    const countByUser = filteredSubs.reduce((m, s) => {
      m[s.userId] = (m[s.userId] || 0) + 1;
      return m;
    }, {});
    return latest
      .map((s) => {
        const u = users.find((x) => x.id === s.userId);
        return {
          id: s.userId,
          name: u?.name ?? s.userName ?? '（已移除）',
          email: u?.email ?? '—',
          total: s.result.total,
          percent: s.result.percent,
          level: s.result.level,
          attempts: countByUser[s.userId] || 1,
          when: s.createdAt,
          _latestSub: s,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredSubs, users, stats]);

  const handleToggle = async (assessment) => {
    setToggling(true);
    setError('');
    try {
      const updated = await api.toggleAssessment(assessment.id, !assessment.enabled);
      onAssessmentsChange((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      setError(e.message || '操作失敗');
    } finally {
      setToggling(false);
    }
  };

  const memberCount = users.filter((u) => u.role !== 'admin').length;
  const dimCount = activeConfig?.DIMENSIONS?.length ?? 0;

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {adminAssessments.length > 0 && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="mb-3 text-sm font-semibold text-slate-500">題庫管理</h3>
          <div className="flex flex-wrap gap-3">
            {adminAssessments.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={selectedId === a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedId === a.id
                      ? 'bg-ink-700 text-white'
                      : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {a.name}
                </button>
                <button
                  type="button"
                  disabled={toggling}
                  onClick={() => handleToggle(a)}
                  title={a.enabled ? '點擊停用此題庫' : '點擊啟用此題庫'}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    a.enabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {a.enabled ? '啟用中' : '已停用'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="註冊人數" value={memberCount} suffix="人" />
        <Kpi label="已填答人數" value={stats?.respondents ?? 0} suffix="人" tip="依每位用戶最新一筆作答計算，重複作答只計算最新一次，避免數據失真。" />
        <Kpi label="總作答次數" value={stats?.totalSubmissions ?? 0} suffix="次" />
        <Kpi label="平均達成率" value={stats?.avgPercent ?? 0} suffix="%" tip="所有填答者最新一筆作答的達成率平均值（總分 / 滿分）。" />
      </section>

      {!stats || stats.respondents === 0 ? (
        <div className="mt-6 rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-lg shadow-slate-200/60">
          {selectedId ? '此題庫尚無任何填答資料。待使用者完成評測後，這裡會即時顯示整體分析。' : '請選擇一個題庫以查看分析。'}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
              <h3 className="mb-2 text-center text-base font-bold text-slate-700">
                整體 {dimCount} 大構面平均落點
              </h3>
              <div className="flex justify-center">
                <RadarChart dimensions={stats.dimensionAverages} />
              </div>
            </section>

            <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
              <h3 className="mb-4 text-base font-bold text-slate-700">各構面平均達成率</h3>
              <BarList
                items={stats.dimensionAverages.map((d) => ({
                  id: d.id,
                  label: d.subtitle,
                  sublabel: d.name,
                  percent: d.percent,
                  color: d.color,
                }))}
              />
            </section>
          </div>

          <section className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
            <h3 className="mb-4 text-base font-bold text-slate-700">落點等級人數分佈</h3>
            <LevelDistribution distribution={stats.levelDistribution} />
          </section>

          <section className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-700">填答者明細</h3>
              <button
                type="button"
                onClick={() => exportAdminCsv(rows, activeConfig, activeConfig?.NAME)}
                className="btn-secondary btn-sm"
              >
                <Download className="h-3.5 w-3.5" /> 匯出 CSV
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">姓名</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">總分</th>
                    <th className="py-2 pr-3 font-medium">達成率</th>
                    <th className="py-2 pr-3 font-medium">落點等級</th>
                    <th className="py-2 pr-3 font-medium">次數</th>
                    <th className="py-2 font-medium">最近作答</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{r.name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{r.email}</td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">{r.total}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{r.percent}%</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                          style={{ background: r.level.color }}
                        >
                          {r.level.badge}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{r.attempts}</td>
                      <td className="py-2.5 text-slate-500">{formatDate(r.when)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
