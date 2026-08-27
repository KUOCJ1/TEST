import { useMemo, useState } from 'react';
import { Download, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import { exportAdminCsv } from '../utils/csvExport';
import { useAssessmentFilter } from '../hooks/useAssessmentFilter';
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

function compareRows(a, b, key, dir) {
  const mul = dir === 'asc' ? 1 : -1;
  if (key === 'level') return mul * a.level.badge.localeCompare(b.level.badge);
  if (key === 'when') return mul * (new Date(a.when).getTime() - new Date(b.when).getTime());
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'string') return mul * av.localeCompare(bv);
  return mul * ((av ?? 0) - (bv ?? 0));
}

export default function AnalyticsTab({ submissions, users, adminAssessments }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
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

  // 填答者明細整張表沒有搜尋、排序，累積人數一多就只能靠瀏覽器 Ctrl-F（A-02）。
  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    return [...list].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [rows, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'email' ? 'asc' : 'desc'); }
  };

  const sortIcon = (column) =>
    sortKey === column ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null;

  const memberCount = users.filter((u) => u.role !== 'admin').length;
  const dimCount = activeConfig?.DIMENSIONS?.length ?? 0;

  return (
    <div>
      {/* 啟用／停用題庫是會影響全站學員的寫入操作，已移到管理後台頁首常駐區塊，
          這裡只留「選擇要看哪個題庫的分析」這個單純的篩選功能（A-03）。 */}
      {adminAssessments.length > 0 && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="mb-3 text-sm font-semibold text-slate-500">選擇題庫</h3>
          <div className="flex flex-wrap gap-3">
            {adminAssessments.map((a) => (
              <button
                key={a.id}
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
            <div className="mb-3 relative w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋姓名或 Email…"
                className="input py-1.5 pl-8 text-sm"
              />
            </div>
            <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    {[
                      { key: 'name', label: '姓名' },
                      { key: 'email', label: 'Email' },
                      { key: 'total', label: '總分' },
                      { key: 'percent', label: '達成率' },
                      { key: 'level', label: '落點等級' },
                      { key: 'attempts', label: '次數' },
                      { key: 'when', label: '最近作答' },
                    ].map(({ key, label }) => (
                      <th key={key} className="py-2 pr-3 font-medium">
                        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-700">
                          {label} {sortIcon(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">查無符合的填答者，請調整搜尋或篩選條件</td></tr>
                  )}
                  {displayRows.map((r) => (
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
