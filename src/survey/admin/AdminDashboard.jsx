import { useEffect, useMemo, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import { exportAdminCsv } from '../utils/csvExport';
import { useAssessmentFilter } from '../hooks/useAssessmentFilter';
import RadarChart from '../components/RadarChart';
import BarList from '../components/charts/BarList';
import LevelDistribution from '../components/charts/LevelDistribution';
import { formatDate } from '../utils/format';
import InfoTip from '../components/InfoTip';
import PhaseBadge from '../components/PhaseBadge';
import BatchUploadSection from './BatchUploadSection';
import { useToast } from '../components/useToast';

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

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [adminAssessments, setAdminAssessments] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [roleChanging, setRoleChanging] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [adminGroups, setAdminGroups] = useState([]);
  const [adminGroupDates, setAdminGroupDates] = useState({});
  const [adminSaving, setAdminSaving] = useState(null);
  const [resetGenerating, setResetGenerating] = useState(null);
  const [copied, setCopied] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let active = true;
    Promise.all([api.adminOverview(), api.adminAssessments(), api.coachGroups()])
      .then(([ov, al, gs]) => {
        if (!active) return;
        setOverview(ov);
        setAdminAssessments(al);
        setAdminGroups(gs);
        setAdminGroupDates(Object.fromEntries(gs.map((g) => [g.id, {
          startDate: g.startDate ? g.startDate.slice(0, 10) : '',
          endDate: g.endDate ? g.endDate.slice(0, 10) : '',
        }])));
      })
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  const submissions = useMemo(() => overview?.submissions ?? [], [overview]);
  const users = useMemo(() => overview?.users ?? [], [overview]);

  const initialId = adminAssessments[0]?.id ?? null;
  const { assessmentIds: _ids, activeId: selectedId, setSelectedId, filtered: filteredSubs } =
    useAssessmentFilter(submissions, initialId);

  // Keep adminAssessments as the canonical list for the toggle UI
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
      setAdminAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      setError(e.message || '操作失敗');
    } finally {
      setToggling(false);
    }
  };

  const handleGroupDateChange = (id, field, value) => {
    setAdminGroupDates((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleGroupSaveTimeline = async (id) => {
    setAdminSaving(id);
    setError('');
    try {
      const { startDate, endDate } = adminGroupDates[id] ?? {};
      const updated = await api.updateGroup(id, { startDate: startDate || null, endDate: endDate || null });
      setAdminGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showToast('已儲存日期');
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setAdminSaving(null);
    }
  };

  const handleGroupPublish = async (id) => {
    setAdminSaving(id);
    setError('');
    try {
      const updated = await api.publishGroup(id);
      setAdminGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showToast('已發佈成果，用戶現可查看報告');
    } catch (e) {
      setError(e.message || '發佈失敗');
    } finally {
      setAdminSaving(null);
    }
  };

  const handleGroupUnpublish = async (id) => {
    setAdminSaving(id);
    setError('');
    try {
      const updated = await api.unpublishGroup(id);
      setAdminGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showToast('已取消發佈');
    } catch (e) {
      setError(e.message || '取消發佈失敗');
    } finally {
      setAdminSaving(null);
    }
  };

  const memberCount = users.filter((u) => u.role !== 'admin').length;
  const dimCount = activeConfig?.DIMENSIONS?.length ?? 0;

  if (!overview && !error) {
    return <p className="py-20 text-center text-slate-400">載入中…</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">管理後台 · 資料分析儀表板</h2>
        <p className="mt-1 text-sm text-slate-500">
          以每位填答者「最新一筆」作答為母體，依題庫分別彙整能力落點。
        </p>
      </header>

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
                  onClick={() => setSelectedId(a.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedId === a.id
                      ? 'bg-brand-600 text-white'
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

      <section className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
        <h3 className="mb-4 text-base font-bold text-slate-700">用戶角色管理</h3>
        <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">姓名</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">目前角色</th>
                <th className="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.users ?? []).filter((u) => u.role !== 'admin').map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{u.name}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{u.email}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.role === 'coach'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {u.role === 'coach' ? '教練' : '一般用戶'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={roleChanging === u.id}
                        onClick={async () => {
                          setRoleChanging(u.id);
                          setError('');
                          try {
                            const newRole = u.role === 'coach' ? 'user' : 'coach';
                            const updated = await api.setUserRole(u.id, newRole);
                            setOverview((prev) => ({
                              ...prev,
                              users: prev.users.map((x) => (x.id === updated.id ? updated : x)),
                            }));
                            showToast(newRole === 'coach' ? `已將 ${u.name} 設為教練` : `已取消 ${u.name} 的教練身份`);
                          } catch (e) {
                            setError(e.message || '操作失敗');
                          } finally {
                            setRoleChanging(null);
                          }
                        }}
                        className={`btn-sm ${u.role === 'coach' ? 'btn-secondary' : 'btn bg-brand-100 text-brand-700 hover:bg-brand-200'}`}
                      >
                        {roleChanging === u.id ? '…' : u.role === 'coach' ? '取消教練身份' : '設為教練'}
                      </button>
                      <button
                        type="button"
                        disabled={resetGenerating === u.id}
                        onClick={async () => {
                          setResetGenerating(u.id);
                          setError('');
                          try {
                            const info = await api.generateResetToken(u.id);
                            const url = `${window.location.origin}${window.location.pathname}?reset=${info.token}`;
                            setResetInfo({ name: u.name, email: u.email, url, hours: info.expiresInHours });
                            setCopied(false);
                          } catch (e) {
                            setError(e.message || '產生失敗');
                          } finally {
                            setResetGenerating(null);
                          }
                        }}
                        className="btn-secondary btn-sm"
                      >
                        {resetGenerating === u.id ? '產生中…' : '產生重設連結'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BatchUploadSection />

      {adminGroups.length > 0 && (
        <section className="mb-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
          <h3 className="mb-3 text-sm font-semibold text-slate-500">班別時間軸與發佈管理</h3>
          <div className="space-y-3">
            {adminGroups.map((g) => {
              const dates = adminGroupDates[g.id] ?? { startDate: '', endDate: '' };
              const saving = adminSaving === g.id;
              return (
                <div key={g.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700">{g.name}</span>
                    {g.companyName && <span className="text-xs text-slate-400">{g.companyName}</span>}
                    <PhaseBadge phase={g.phase} />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">開始日期</label>
                      <input
                        type="date"
                        value={dates.startDate}
                        onChange={(e) => handleGroupDateChange(g.id, 'startDate', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">截止日期</label>
                      <input
                        type="date"
                        value={dates.endDate}
                        onChange={(e) => handleGroupDateChange(g.id, 'endDate', e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGroupSaveTimeline(g.id)}
                      disabled={saving}
                      className="btn-secondary btn-sm"
                    >
                      {saving ? '儲存中…' : '儲存日期'}
                    </button>
                    {g.publishedAt ? (
                      <button
                        type="button"
                        onClick={() => handleGroupUnpublish(g.id)}
                        disabled={saving}
                        className="btn-warning btn-sm"
                      >
                        取消發佈
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGroupPublish(g.id)}
                        disabled={saving}
                        className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
                      >
                        發佈成果
                      </button>
                    )}
                    {g.publishedAt && (
                      <span className="text-xs text-slate-400">
                        發佈於 {new Date(g.publishedAt).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {resetInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setResetInfo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-dialog-title" className="text-lg font-bold text-slate-800">密碼重設連結</h3>
            <p className="mt-1 text-sm text-slate-500">
              給 <span className="font-semibold">{resetInfo.name}</span>（{resetInfo.email}）。
              此連結 {resetInfo.hours} 小時內有效，請複製後私下交給該使用者，他可自行設定新密碼。
            </p>
            <textarea
              readOnly
              value={resetInfo.url}
              onFocus={(e) => e.target.select()}
              className="input mt-3 bg-slate-50"
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(resetInfo.url);
                    setCopied(true);
                    showToast('已複製連結');
                  } catch {
                    setCopied(false);
                  }
                }}
                className="btn-primary"
              >
                {copied ? <><Check className="h-4 w-4" /> 已複製</> : '複製連結'}
              </button>
              <button
                type="button"
                onClick={() => setResetInfo(null)}
                className="btn-ghost"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
