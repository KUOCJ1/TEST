import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Download, LogOut, CircleHelp,
  ClipboardList, ChartColumn, UsersRound, GraduationCap, Shield, User,
} from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { api } from './api/client';
import AssessmentCard from './components/AssessmentCard';
import RaterSetup from './components/RaterSetup';
import SurveyApp from './SurveyApp';
import UserDashboard from './dashboard/UserDashboard';
import MultiRaterHome from './analysis/MultiRaterHome';
import ProfilePage from './profile/ProfilePage';
import HelpModal from './components/HelpModal';
import OnboardingBanner from './components/OnboardingBanner';
import ChatBot from './components/ChatBot';
import ErrorBoundary from './components/ErrorBoundary';

const CoachDashboard = lazy(() => import('./coach/CoachDashboard'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

function DashboardFallback() {
  return <p className="py-20 text-center text-slate-400">載入中…</p>;
}

function AssessmentHome({ onStartSurvey, onViewAnalysis, onGoTo360, refreshKey }) {
  const [assessments, setAssessments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.assessments(), api.mySubmissions(), api.myGroups()])
      .then(([aList, sList, gList]) => { setAssessments(aList); setMySubmissions(sList); setMyGroups(gList); })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const latestByAssessment = mySubmissions.reduce((m, s) => {
    const id = s.assessmentId ?? 'ai-competency';
    if (!m[id] || new Date(s.createdAt) > new Date(m[id].createdAt)) m[id] = s;
    return m;
  }, {});

  const groupPhaseByAssessmentId = myGroups.reduce((m, g) => {
    const id = g.assessmentId ?? 'ai-competency';
    if (!m[id]) m[id] = g.phase;
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
              groupPhase={groupPhaseByAssessmentId[a.id] ?? null}
              onStart={onStartSurvey}
              onViewAnalysis={onViewAnalysis}
              onGoTo360={onGoTo360}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// 自評一律直接作答；「評測他人」的返回/提交完成目的地則是 360° 分頁。
function returnPathFor(raterType) {
  return raterType && raterType !== 'self' ? '/360' : '/home';
}

function AnalysisRoute({ user, refreshKey, onTakeSurvey, onResultLoad }) {
  const { assessmentId = null } = useParams();
  return (
    <UserDashboard
      key={`${refreshKey}-${assessmentId ?? ''}`}
      user={user}
      initialAssessmentId={assessmentId}
      onTakeSurvey={onTakeSurvey}
      onResultLoad={onResultLoad}
    />
  );
}

function MultiRaterRoute({ user, refreshKey, onRateOthers }) {
  const { assessmentId = null } = useParams();
  return (
    <MultiRaterHome
      key={`${refreshKey}-${assessmentId ?? ''}`}
      user={user}
      initialAssessmentId={assessmentId}
      onRateOthers={onRateOthers}
    />
  );
}

function SurveyRoute({ user, onSubmitted }) {
  const { assessmentId } = useParams();
  const location = useLocation();
  const rateeId = location.state?.rateeId ?? user.id;
  const raterType = location.state?.raterType ?? 'self';
  const rateeName = location.state?.rateeName;
  return (
    <SurveyApp
      key={`${assessmentId}-${rateeId}-${raterType}`}
      user={user}
      assessmentId={assessmentId}
      rateeId={rateeId}
      raterType={raterType}
      rateeName={rateeName}
      onSubmitted={() => onSubmitted(raterType)}
    />
  );
}

function RaterSetupRoute({ onConfirm, onCancel }) {
  const { assessmentId } = useParams();
  const location = useLocation();
  const preset = location.state ?? null;
  return (
    <RaterSetup
      onConfirm={(rateeId, raterType, rateeName) => onConfirm(assessmentId, rateeId, raterType, rateeName)}
      onCancel={onCancel}
      initialRateeId={preset?.rateeId ?? null}
      initialRaterType={preset?.raterType ?? ''}
    />
  );
}

export default function AppShell() {
  const { user, isAdmin, isCoach, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const defaultAid = user?.preferences?.defaultAssessmentId || null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chatContext, setChatContext] = useState(null);

  const helpRole = isAdmin ? 'admin' : (isCoach ? 'coach' : 'user');

  const handleResultLoad = useCallback((result) => setChatContext({ result }), []);

  // shortLabel 供手機底部導覽使用（寬度有限，取最短可辨識的字樣）。
  const tabs = [
    { id: 'home', label: '我的評量', shortLabel: '評量', path: '/home', Icon: ClipboardList },
    { id: 'analysis', label: '我的分析', shortLabel: '分析', path: '/analysis', Icon: ChartColumn },
    { id: '360', label: '360° 評測', shortLabel: '360°', path: '/360', Icon: UsersRound },
    ...(isCoach && !isAdmin ? [{ id: 'coach', label: '教練後台', shortLabel: '教練', path: '/coach', Icon: GraduationCap }] : []),
    ...(isAdmin ? [
      { id: 'coach', label: '教練後台', shortLabel: '教練', path: '/coach', Icon: GraduationCap },
      { id: 'admin', label: '管理後台', shortLabel: '管理', path: '/admin', Icon: Shield },
    ] : []),
    { id: 'profile', label: '個人設定', shortLabel: '設定', path: '/profile', Icon: User },
  ];

  const handleStartSurvey = (id) => {
    navigate(`/survey/${id}`, { state: { rateeId: user.id, raterType: 'self' } });
  };
  const handleRateOthers = (id, presetRateeId = null, presetRaterType = '') => {
    navigate(`/rater-setup/${id}`, presetRateeId ? { state: { rateeId: presetRateeId, raterType: presetRaterType } } : undefined);
  };
  const handleRaterConfirm = (assessmentId, rateeId, raterType, rateeName) => {
    navigate(`/survey/${assessmentId}`, { state: { rateeId, raterType, rateeName } });
  };
  const handleViewAnalysis = (id) => navigate(`/analysis/${id}`);
  const handleGoTo360 = (id) => navigate(`/360/${id}`);
  const handleSubmitted = (raterType) => {
    setRefreshKey((k) => k + 1);
    navigate(returnPathFor(raterType));
  };

  const isSurveyOrRaterSetup = location.pathname.startsWith('/survey') || location.pathname.startsWith('/rater-setup');
  const isRaterSetup = location.pathname.startsWith('/rater-setup');
  const backTarget = isRaterSetup ? '/360' : returnPathFor(location.state?.raterType);
  const isTabActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const showBottomNav = !isSurveyOrRaterSetup;

  return (
    // 底部導覽是 fixed，手機需保留等高的內距，否則會蓋住頁面最後一段內容。
    <div className={`min-h-screen ${showBottomNav ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0' : ''}`}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-800">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            全方位職能評測
          </span>

          {isSurveyOrRaterSetup ? (
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="btn-ghost btn-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {backTarget === '/360' ? '返回 360° 評測' : '返回評量列表'}
            </button>
          ) : (
            /* 手機改用畫面底部的 tab bar（見下方 <nav>），這裡只在 sm 以上顯示，
               避免窄螢幕時 logo 與右側按鈕把分頁列擠成無法點擊的細條。 */
            <nav className="hidden flex-1 flex-wrap gap-1 sm:flex">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={isTabActive(t.path) ? 'page' : undefined}
                  onClick={() => navigate(t.path)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isTabActive(t.path)
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <span className="hidden text-slate-500 sm:inline">
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
              aria-label="使用說明"
              className="btn-secondary btn-sm"
            >
              <CircleHelp className="h-4 w-4" /> <span className="hidden sm:inline">使用說明</span>
            </button>
            <a
              href={`${import.meta.env.BASE_URL}user-manual.pdf`}
              download="職能評測平台使用手冊.pdf"
              title="下載 PDF 使用手冊"
              aria-label="下載 PDF 使用手冊"
              className="btn-secondary btn-sm"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">手冊下載</span>
            </a>
            <button
              type="button"
              onClick={logout}
              aria-label="登出"
              className="btn-ghost btn-sm"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </div>
      </header>

      {/* 只包住路由內容，不含頁首與底部導覽——單一頁面出錯時，使用者仍能切換到
          其他分頁自救，而不是整個 App 變白畫面。resetKey 用路徑，換頁即自動復原。 */}
      <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Navigate to={defaultAid ? `/survey/${defaultAid}` : '/home'} replace />} />

        <Route
          path="/home"
          element={
            <AssessmentHome
              key={refreshKey}
              refreshKey={refreshKey}
              onStartSurvey={handleStartSurvey}
              onViewAnalysis={handleViewAnalysis}
              onGoTo360={handleGoTo360}
            />
          }
        />

        <Route
          path="/analysis/:assessmentId?"
          element={
            <AnalysisRoute
              user={user}
              refreshKey={refreshKey}
              onTakeSurvey={handleStartSurvey}
              onResultLoad={handleResultLoad}
            />
          }
        />

        <Route
          path="/360/:assessmentId?"
          element={<MultiRaterRoute user={user} refreshKey={refreshKey} onRateOthers={handleRateOthers} />}
        />

        <Route
          path="/rater-setup/:assessmentId"
          element={<RaterSetupRoute onConfirm={handleRaterConfirm} onCancel={() => navigate('/360')} />}
        />

        <Route
          path="/survey/:assessmentId"
          element={<SurveyRoute user={user} onSubmitted={handleSubmitted} />}
        />

        {isCoach && (
          <Route
            path="/coach"
            element={(
              <Suspense fallback={<DashboardFallback />}>
                <CoachDashboard key={refreshKey} />
              </Suspense>
            )}
          />
        )}

        {isAdmin && (
          <Route
            path="/admin"
            element={(
              <Suspense fallback={<DashboardFallback />}>
                <AdminDashboard key={refreshKey} />
              </Suspense>
            )}
          />
        )}

        <Route path="/profile" element={<ProfilePage />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </ErrorBoundary>

      {/* 手機底部導覽：桌機（sm 以上）隱藏，改用頁首的分頁列。作答／選擇受評者
          時隱藏，讓使用者專注填答，也與頁首「返回」的行為一致。 */}
      {showBottomNav && (
        <nav
          aria-label="主要導覽"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden print:hidden"
        >
          <div className="flex items-stretch justify-around">
            {tabs.map((t) => {
              const active = isTabActive(t.path);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(t.path)}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                    active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <t.Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
                  {t.shortLabel}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {helpOpen && <HelpModal role={helpRole} onClose={() => setHelpOpen(false)} />}

      <ChatBot context={chatContext} liftForBottomNav={showBottomNav} />
    </div>
  );
}
