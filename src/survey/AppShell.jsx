import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import SurveyApp from './SurveyApp';
import UserDashboard from './dashboard/UserDashboard';
import AdminDashboard from './admin/AdminDashboard';

export default function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const [view, setView] = useState(isAdmin ? 'admin' : 'survey');
  // 用於在送出評測後強制刷新「我的分析」資料。
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = [
    { id: 'survey', label: '開始評測' },
    { id: 'me', label: '我的分析' },
    ...(isAdmin ? [{ id: 'admin', label: '管理後台' }] : []),
  ];

  const handleSubmitted = () => {
    setRefreshKey((k) => k + 1);
    setView('me');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-base font-extrabold text-teal-700">AI 職能評測</span>

          <nav className="flex flex-1 flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  view === t.id
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name}
              {isAdmin && (
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  管理員
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      {view === 'survey' && <SurveyApp user={user} onSubmitted={handleSubmitted} />}
      {view === 'me' && (
        <UserDashboard key={refreshKey} user={user} onTakeSurvey={() => setView('survey')} />
      )}
      {view === 'admin' && isAdmin && <AdminDashboard key={refreshKey} />}
    </div>
  );
}
