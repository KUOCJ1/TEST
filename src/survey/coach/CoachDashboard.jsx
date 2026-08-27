import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';
import GroupWorkspace from './GroupWorkspace';
import MultiRaterTab from './MultiRaterTab';
import OnboardingBanner from '../components/OnboardingBanner';
import LoadingState from '../components/LoadingState';

export default function CoachDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('group');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.coachOverview()
      .then(setOverview)
      .catch((e) => setError(e.message || '載入失敗'));
  }, []);

  if (!overview && !error) return <LoadingState />;
  if (error) return <p className="py-20 text-center text-red-500">{error}</p>;

  const TABS = [
    { id: 'group', label: '班級' },
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
        {tab === 'group' && (
          <GroupWorkspace users={overview.users} currentUserId={user.id} />
        )}
        {tab === 'multirater' && (
          <MultiRaterTab users={overview.users} submissions={overview.submissions} />
        )}
      </div>
    </main>
  );
}
