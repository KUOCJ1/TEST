import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import AnalyticsTab from './AnalyticsTab';
import UsersTab from './UsersTab';
import GroupsTab from './GroupsTab';
import BatchUploadSection from './BatchUploadSection';
import QuickAnalysisTab from '../analysis/QuickAnalysisTab';

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

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`rounded-md px-4 py-1.5 transition-colors ${
              tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'quickAnalysis' && (
        <QuickAnalysisTab users={users} />
      )}
      {tab === 'analytics' && (
        <AnalyticsTab
          submissions={submissions}
          users={users}
          adminAssessments={adminAssessments}
          onAssessmentsChange={setAdminAssessments}
        />
      )}
      {tab === 'users' && (
        <UsersTab users={users} onUserChanged={handleUserChanged} />
      )}
      {tab === 'groups' && (
        <GroupsTab groups={adminGroups} onGroupUpdated={handleGroupUpdated} />
      )}
      {tab === 'import' && <BatchUploadSection />}
    </main>
  );
}
