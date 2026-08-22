import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import AnalyticsTab from './AnalyticsTab';
import UsersTab from './UsersTab';
import GroupsTab from './GroupsTab';
import QuickAnalysisTab from '../analysis/QuickAnalysisTab';

// 內含 xlsx（體積較大），只有點開「批次上傳」分頁才需要，獨立拆成自己的 chunk。
const BatchUploadSection = lazy(() => import('./BatchUploadSection'));

const TABS = [
  { id: 'quickAnalysis', label: '快速分析' },
  { id: 'analytics', label: '數據分析' },
  { id: 'users', label: '用戶管理' },
  { id: 'groups', label: '班別與發佈' },
  { id: 'import', label: '批次上傳' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('analytics');
  const [overview, setOverview] = useState(null);
  const [adminAssessments, setAdminAssessments] = useState([]);
  const [adminGroups, setAdminGroups] = useState([]);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.adminOverview(), api.adminAssessments(), api.coachGroups()])
      .then(([ov, al, gs]) => {
        if (!active) return;
        setOverview(ov);
        setAdminAssessments(al);
        setAdminGroups(gs);
      })
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  const submissions = useMemo(() => overview?.submissions ?? [], [overview]);
  const users = useMemo(() => overview?.users ?? [], [overview]);

  const handleUserChanged = (updated) => {
    setOverview((prev) => ({
      ...prev,
      users: prev.users.map((x) => (x.id === updated.id ? updated : x)),
    }));
  };

  const handleGroupUpdated = (updated) => {
    setAdminGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  // 啟用／停用題庫是會影響全站學員的寫入操作，原本藏在「數據分析」分頁裡、KPI
  // 數字上方，很容易被忽略也容易被誤觸（A-03）。移到頁首常駐區塊，不隨分頁切換。
  const handleToggleAssessment = async (assessment) => {
    setToggling(true);
    setToggleError('');
    try {
      const updated = await api.toggleAssessment(assessment.id, !assessment.enabled);
      setAdminAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      setToggleError(e.message || '操作失敗');
    } finally {
      setToggling(false);
    }
  };

  if (!overview && !error) {
    return <p className="py-20 text-center text-slate-400">載入中…</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">管理後台</h2>
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
          <h3 className="mb-1 text-sm font-semibold text-slate-500">題庫啟用狀態</h3>
          <p className="mb-3 text-xs text-slate-400">
            停用後，學員將無法在「選擇評量」看到並開始作答此題庫；既有作答紀錄與報告不受影響。
          </p>
          <div className="flex flex-wrap gap-3">
            {adminAssessments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
                <span className="text-sm font-medium text-slate-700">{a.name}</span>
                <button
                  type="button"
                  disabled={toggling}
                  onClick={() => handleToggleAssessment(a)}
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
          {toggleError && <p className="mt-2 text-xs text-red-600">{toggleError}</p>}
        </section>
      )}

      {/* 五個分頁橫排在窄螢幕上會撐破版面（A-01）：外層限制寬度並允許水平捲動，
          分頁本身不換行，改成滑動而不是把整頁往右推寬。 */}
      <div className="mb-5 max-w-full overflow-x-auto">
        <div className="flex w-fit gap-1 whitespace-nowrap rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-md px-4 py-1.5 transition-colors ${
                tab === id ? 'bg-white text-brass-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'quickAnalysis' && (
        <QuickAnalysisTab users={users} />
      )}
      {tab === 'analytics' && (
        <AnalyticsTab
          submissions={submissions}
          users={users}
          adminAssessments={adminAssessments}
        />
      )}
      {tab === 'users' && (
        <UsersTab users={users} onUserChanged={handleUserChanged} />
      )}
      {tab === 'groups' && (
        <GroupsTab groups={adminGroups} onGroupUpdated={handleGroupUpdated} />
      )}
      {tab === 'import' && (
        <Suspense fallback={<p className="py-20 text-center text-slate-400">載入中…</p>}>
          <BatchUploadSection />
        </Suspense>
      )}
    </main>
  );
}
