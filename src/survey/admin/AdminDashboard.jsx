import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import RadarChart from '../components/RadarChart';
import BarList from '../components/charts/BarList';
import LevelDistribution from '../components/charts/LevelDistribution';
import { formatDate } from '../utils/format';

function Kpi({ label, value, suffix }) {
  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-800">
        {value}
        {suffix && <span className="ml-1 text-base font-semibold text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [adminAssessments, setAdminAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.adminOverview(), api.adminAssessments()])
      .then(([ov, al]) => {
        if (!active) return;
        setOverview(ov);
        setAdminAssessments(al);
        if (al.length > 0) setSelectedId((prev) => prev ?? al[0].id);
      })
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  const handleToggle = async (assessment) => {
    setToggling(true);
    try {
      const updated = await api.toggleAssessment(assessment.id, !assessment.enabled);
      setAdminAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      alert(e.message || '操作失敗');
    } finally {
      setToggling(false);
    }
  };

  const submissions = useMemo(() => overview?.submissions ?? [], [overview]);
  const users = useMemo(() => overview?.users ?? [], [overview]);

  const activeConfig = useMemo(
    () => (selectedId ? getAssessment(selectedId) : null),
    [selectedId],
  );

  const filteredSubs = useMemo(
    () => submissions.filter((s) => (s.assessmentId ?? 'ai-competency') === selectedId),
    [submissions, selectedId],
  );

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
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredSubs, users, stats]);

  const memberCount = users.filter((u) => u.role !== 'admin').length;
  const dimCount = activeConfig?.DIMENSIONS?.length ?? 0;

  if (!overview && !error) {
    return <p className="py-20 text-center text-slate-400">載入中…</p>;
  }

  if (error) {
    return <p className="py-20 text-center text-red-500">{error}</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">管理後台 · 資料分析儀表板</h2>
        <p className="mt-1 text-sm text-slate-500">
          以每位填答者「最新一筆」作答為母體，依題庫分別彙整能力落點。
        </p>
      </header>

      {adminAssessments.length > 0 && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="mb-3 text-sm font-semibold text-slate-500">題庫管理</h3>
          <div className="flex flex-wrap gap-3">
            {adminAssessments.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedId === a.id
                      ? 'bg-teal-600 text-white'
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
        <Kpi label="已填答人數" value={stats?.respondents ?? 0} suffix="人" />
        <Kpi label="總作答次數" value={stats?.totalSubmissions ?? 0} suffix="次" />
        <Kpi label="平均達成率" value={stats?.avgPercent ?? 0} suffix="%" />
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
            <h3 className="mb-4 text-base font-bold text-slate-700">填答者明細</h3>
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
    </main>
  );
}
