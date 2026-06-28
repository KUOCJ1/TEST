import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './auth/useAuth';
import { api } from './api/client';
import { getAssessment } from './data/assessments/index.js';
import AssessmentCard from './components/AssessmentCard';
import RaterSetup from './components/RaterSetup';
import SurveyApp from './SurveyApp';
import UserDashboard from './dashboard/UserDashboard';
import ProfilePage from './profile/ProfilePage';
import HelpModal from './components/HelpModal';
import OnboardingBanner from './components/OnboardingBanner';

const CoachDashboard = lazy(() => import('./coach/CoachDashboard'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

function DashboardFallback() {
  return <p className="py-20 text-center text-slate-400">載入中…</p>;
}

function AssessmentHome({ onStartSurvey, onViewAnalysis, refreshKey }) {
  const [assessments, setAssessments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.assessments(), api.mySubmissions()])
      .then(([aList, sList]) => { setAssessments(aList); setMySubmissions(sList); })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const latestByAssessment = mySubmissions.reduce((m, s) => {
    const id = s.assessmentId ?? 'ai-competency';
    if (!m[id] || new Date(s.createdAt) > new Date(m[id].createdAt)) m[id] = s;
    return m;
  }, {});

  if (loading) return <p className="py-20 text-center text-slate-400">載入中…</p>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <OnboardingBanner role="user" />
      <header className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">選擇評量</h2>
        <p className="mt-1 text-sm text-slate-500">選擇一個題庫開始作答，或點擊「查看分析」瀏覽歷次結果。</p>
      </header>
      {assessments.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-lg shadow-slate-200/60">
          目前沒有可用的評量。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              latestSubmission={latestByAssessment[a.id] ?? null}
              onStart={onStartSurvey}
              onViewAnalysis={onViewAnalysis}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function AppShell() {
  const { user, isAdmin, isCoach, logout } = useAuth();
  const defaultAid = user?.preferences?.defaultAssessmentId || null;
  const [view, setView] = useState(defaultAid ? 'survey' : 'home');
  const [activeAssessmentId, setActiveAssessmentId] = useState(defaultAid);
  const [raterConfig, setRaterConfig] = useState(null); // { rateeId, raterType }
  const [refreshKey, setRefreshKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const helpRole = isAdmin ? 'admin' : (isCoach ? 'coach' : 'user');

  const tabs = [
    { id: 'home', label: '我的評量' },
    { id: 'analysis', label: '我的分析' },
    ...(isCoach && !isAdmin ? [{ id: 'coach', label: '教練後台' }] : []),
    ...(isAdmin ? [{ id: 'coach', label: '教練後台' }, { id: 'admin', label: '管理後台' }] : []),
    { id: 'profile', label: '個人設定' },
  ];

  const handleStartSurvey = (id) => {
    setActiveAssessmentId(id);
    const config = getAssessment(id);
    if (config?.SUPPORTS_360) {
      setRaterConfig(null);
      setView('rater-setup');
    } else {
      setRaterConfig({ rateeId: user.id, raterType: 'self' });
      setView('survey');
    }
  };
  const handleRaterConfirm = (rateeId, raterType, rateeName) => {
    setRaterConfig({ rateeId, raterType, rateeName });
    setView('survey');
  };
  const handleViewAnalysis = (id) => { setActiveAssessmentId(id); setView('analysis'); };
  const handleSubmitted = () => { setRefreshKey((k) => k + 1); setView('home'); };

  const handleTabClick = (id) => {
    setView(id);
    if (id !== 'analysis') setActiveAssessmentId(null);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-800">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            全方位職能評測
          </span>

          {(view === 'survey' || view === 'rater-setup') ? (
            <button
              type="button"
              onClick={() => setView('home')}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              ← 返回評量列表
            </button>
          ) : (
            <nav className="flex flex-1 flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={view === t.id ? 'page' : undefined}
                  onClick={() => handleTabClick(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    view === t.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name}
              {isAdmin && (
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  管理員
                </span>
              )}
              {!isAdmin && user.role === 'coach' && (
                <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                  教練
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              說明
            </button>
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

      {view === 'home' && (
        <AssessmentHome
          key={refreshKey}
          refreshKey={refreshKey}
          onStartSurvey={handleStartSurvey}
          onViewAnalysis={handleViewAnalysis}
        />
      )}

      {view === 'rater-setup' && activeAssessmentId && (
        <RaterSetup
          user={user}
          onConfirm={handleRaterConfirm}
          onCancel={() => setView('home')}
        />
      )}

      {view === 'survey' && activeAssessmentId && (
        <SurveyApp
          key={`${activeAssessmentId}-${raterConfig?.rateeId}-${raterConfig?.raterType}`}
          user={user}
          assessmentId={activeAssessmentId}
          rateeId={raterConfig?.rateeId}
          raterType={raterConfig?.raterType}
          rateeName={raterConfig?.rateeName}
          onSubmitted={handleSubmitted}
        />
      )}

      {view === 'analysis' && (
        <UserDashboard
          key={`${refreshKey}-${activeAssessmentId}`}
          user={user}
          initialAssessmentId={activeAssessmentId}
          onTakeSurvey={handleStartSurvey}
        />
      )}

      {view === 'coach' && isCoach && (
        <Suspense fallback={<DashboardFallback />}>
          <CoachDashboard key={refreshKey} />
        </Suspense>
      )}

      {view === 'admin' && isAdmin && (
        <Suspense fallback={<DashboardFallback />}>
          <AdminDashboard key={refreshKey} />
        </Suspense>
      )}

      {view === 'profile' && <ProfilePage />}

      {helpOpen && <HelpModal role={helpRole} onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
