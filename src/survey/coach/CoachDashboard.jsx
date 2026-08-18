import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';
import IndividualTab from './IndividualTab';
import GroupTab from './GroupTab';
import MultiRaterTab from './MultiRaterTab';
import QuickAnalysisTab from '../analysis/QuickAnalysisTab';
import OnboardingBanner from '../components/OnboardingBanner';

export default function CoachDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('quickAnalysis');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.coachOverview()
      .then(setOverview)
      .catch((e) => setError(e.message || '載入失敗'));
  }, []);

  if (!overview && !error) return <p className="py-20 text-center text-slate-400">載入中…</p>;
  if (error) return <p className="py-20 text-center text-red-500">{error}</p>;

  const TABS = [
    { id: 'quickAnalysis', label: '快速分析' },
    { id: 'individual', label: '個人評語' },
    { id: 'group', label: '班別管理' },
    { id: 'multirater', label: '360° 進度' },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <OnboardingBanner role="coach" />
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">教練後台</h2>
        <p className="mt-1 text-sm text-slate-500">
          為學員撰寫評語與精進建議，並管理班別整體評量。
        </p>
      </header>

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`rounded-md px-4 py-1.5 transition-colors ${
              tab === id ? 'bg-white text-brass-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        {tab === 'quickAnalysis' && (
          <QuickAnalysisTab users={overview.users} />
        )}
        {tab === 'individual' && (
          <IndividualTab users={overview.users} submissions={overview.submissions} currentUserId={user.id} />
        )}
        {tab === 'group' && (
          <GroupTab users={overview.users} submissions={overview.submissions} />
        )}
        {tab === 'multirater' && (
          <MultiRaterTab users={overview.users} submissions={overview.submissions} />
        )}
      </div>
    </main>
  );
}
