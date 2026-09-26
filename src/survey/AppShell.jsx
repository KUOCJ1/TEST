import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList, ChartColumn, UsersRound, GraduationCap, Shield, BookOpen,
} from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { api } from './api/client';
import { computeNextStep } from './utils/nextStep';
import AssessmentCard from './components/AssessmentCard';
import NextStepCard from './components/NextStepCard';
import GroupStatusBar from './components/GroupStatusBar';
import GoalProgressChip from './components/GoalProgressChip';
import RaterSetup from './components/RaterSetup';
import SurveyApp from './SurveyApp';
import UserDashboard from './dashboard/UserDashboard';
import MultiRaterHome from './analysis/MultiRaterHome';
import MyLearningPage from './learning/MyLearningPage';
import ProfilePage from './profile/ProfilePage';
import HelpModal from './components/HelpModal';
import OnboardingBanner from './components/OnboardingBanner';
import ChatBot from './components/ChatBot';
import UserMenu from './components/UserMenu';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingState from './components/LoadingState';

const CoachDashboard = lazy(() => import('./coach/CoachDashboard'));

const PAGE_TITLES = [
  ['/home', '我的評量'], ['/analysis', '我的分析'], ['/360', '360° 評測'], ['/rater-setup', '360° 評測'],
  ['/learning', '我的學習'], ['/coach', '教練後台'], ['/admin', '管理後台'], ['/profile', '個人設定'],
  ['/survey', '作答中'],
];
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

function DashboardFallback() {
  return <LoadingState />;
}

function AssessmentHome({ onStartSurvey, onViewAnalysis, onGoTo360, refreshKey }) {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.assessments(), api.mySubmissions(), api.myGroups(), api.groupMembers(), api.myGoals()])
      .then(([aList, sList, gList, mList, goalList]) => {
        setAssessments(aList);
        setMySubmissions(sList);
        setMyGroups(gList);
        setGroupMembers(mList);
        setGoals(goalList);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const latestByAssessment = mySubmissions.reduce((m, s) => {
    const id = s.assessmentId ?? 'ai-competency';
    if (!m[id] || new Date(s.createdAt) > new Date(m[id].createdAt)) m[id] = s;
    return m;
  }, {});

  const groupByAssessmentId = myGroups.reduce((m, g) => {
    const id = g.assessmentId ?? 'ai-competency';
    if (!m[id]) m[id] = g;
    return m;
  }, {});
  const groupPhaseByAssessmentId = Object.fromEntries(
    Object.entries(groupByAssessmentId).map(([id, g]) => [id, g.phase]),
  );

  // 該評量、該班級「已作答過的階段」（課前／課後）。用來判斷卡片是否該完全鎖住——
  // 後端已改成同班同階段才擋重複（例如課前做過仍可再做課後），卡片這邊若只看
  // 「有沒有任何一次作答」就整個鎖死，使用者會連課後複測的入口都點不到。
  const submittedPhasesByAssessment = mySubmissions.reduce((m, s) => {
    if ((s.raterType ?? 'self') !== 'self') return m; // 只算自評，不算 360 他評
    const id = s.assessmentId ?? 'ai-competency';
    const group = groupByAssessmentId[id];
    if (!group || s.groupId !== group.id) return m; // 不屬於目前這個班的舊資料不計
    (m[id] ??= new Set()).add(s.phase ?? 'pre');
    return m;
  }, {});

  if (loading) return <LoadingState />;

  const nextStep = computeNextStep({ assessments, mySubmissions, myGroups, groupMembers, goals });
  // 班級狀態條優先顯示「下一步」正在講的那個班；沒有的話（例如下一步是 360°
  // 他評或看報告）退回顯示第一個進行中的班別，讓使用者至少知道自己現在的
  // 班級狀態，而不是完全不顯示。
  const statusGroup = myGroups.find((g) => g.id === nextStep?.groupId)
    ?? myGroups.find((g) => g.phase === 'in_progress')
    ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <OnboardingBanner role="user" show={mySubmissions.length === 0} />
      <NextStepCard nextStep={nextStep} onStartSurvey={onStartSurvey} onGoTo360={onGoTo360} onViewAnalysis={onViewAnalysis} />
      {/* 班級狀態與目標摘要並排成一條資訊列（Sprint 8），不再各佔一整列。 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row [&>*]:flex-1 [&:empty]:hidden">
        <GroupStatusBar group={statusGroup} />
        <GoalProgressChip goals={goals} onClick={() => navigate('/learning')} />
      </div>
      <header className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">選擇評量</h2>
        <p className="mt-1 text-sm text-slate-500">選擇一個題庫開始作答，或點擊「查看分析」瀏覽歷次結果。</p>
      </header>
      {assessments.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-lg shadow-slate-200/60">
          目前沒有可用的評量，請洽詢您的教練或平台管理者開放評量。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              latestSubmission={latestByAssessment[a.id] ?? null}
              groupPhase={groupPhaseByAssessmentId[a.id] ?? null}
              submittedPhases={submittedPhasesByAssessment[a.id] ?? null}
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
      onSubmitted={(result) => onSubmitted(raterType, result)}
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
  // 在哪個作答頁送出過（Sprint 8 驗收條件 8.6）：作答中隱藏 AI 小幫手浮動按鈕（它會
  // 蓋住選項，也打斷專注），送出、結果就地顯示後才讓它出現。記路徑而不是布林值，
  // 換到別的作答頁自然就回到「作答中」狀態，不必另外重設。
  const [submittedPath, setSubmittedPath] = useState(null);

  const helpRole = isAdmin ? 'admin' : (isCoach ? 'coach' : 'user');

  const handleResultLoad = useCallback((result) => setChatContext({ result }), []);

  // shortLabel 供手機底部導覽使用（寬度有限，取最短可辨識的字樣）。
  const tabs = [
    { id: 'home', label: '我的評量', shortLabel: '評量', path: '/home', Icon: ClipboardList },
    { id: 'analysis', label: '我的分析', shortLabel: '分析', path: '/analysis', Icon: ChartColumn },
    { id: '360', label: '360° 評測', shortLabel: '360°', path: '/360', Icon: UsersRound },
    { id: 'learning', label: '我的學習', shortLabel: '學習', path: '/learning', Icon: BookOpen },
    ...(isCoach && !isAdmin ? [{ id: 'coach', label: '教練後台', shortLabel: '教練', path: '/coach', Icon: GraduationCap }] : []),
    ...(isAdmin ? [
      { id: 'coach', label: '教練後台', shortLabel: '教練', path: '/coach', Icon: GraduationCap },
      { id: 'admin', label: '管理後台', shortLabel: '管理', path: '/admin', Icon: Shield },
    ] : []),
    // 「個人設定」收進右上角使用者選單（Sprint 8）：分頁只放功能頁，桌機不再折成兩行、
    // 手機底部導覽最多 6 項。
  ];

  const handleStartSurvey = (id) => {
    navigate(`/survey/${id}`, { state: { rateeId: user.id, raterType: 'self' } });
  };
  const handleRateOthers = (id, presetRateeId = null, presetRaterType = '', presetRateeName = '') => {
    // 在「360° 評測」頁面點某位成員的關係按鈕時，對象與關係已經一次選好，不必再
    // 跳到 RaterSetup 把兩個欄位預先填好又要求再按一次「開始評測」（S-05：兩個
    // 畫面、一個決定）。只有在兩者都還沒定案時才進 RaterSetup 讓使用者選。
    if (presetRateeId && presetRaterType) {
      navigate(`/survey/${id}`, { state: { rateeId: presetRateeId, raterType: presetRaterType, rateeName: presetRateeName } });
      return;
    }
    navigate(`/rater-setup/${id}`, presetRateeId ? { state: { rateeId: presetRateeId, raterType: presetRaterType } } : undefined);
  };
  const handleRaterConfirm = (assessmentId, rateeId, raterType, rateeName) => {
    navigate(`/survey/${assessmentId}`, { state: { rateeId, raterType, rateeName } });
  };
  const handleViewAnalysis = (id) => navigate(`/analysis/${id}`);
  const handleGoTo360 = (id) => navigate(`/360/${id}`);
  // 送出後不再立刻導頁——讓 SurveyApp 先把結果就地顯示出來，使用者按下
  // 「查看完整分析／返回 360° 評測」才離開，避免作答完連自己的分數都看不到。
  const handleSubmitted = (raterType, result) => {
    setRefreshKey((k) => k + 1);
    setSubmittedPath(location.pathname);
    // 自評送出後結果就地顯示在作答頁：把結果交給 AI 小幫手當上下文，使用者可以直接
    // 問「這個結果怎麼解讀」。他評（360°）是別人的結果，不帶。
    if (raterType === 'self' && result) setChatContext({ result });
  };

  const isSurveyOrRaterSetup = location.pathname.startsWith('/survey') || location.pathname.startsWith('/rater-setup');
  const isRaterSetup = location.pathname.startsWith('/rater-setup');
  const backTarget = isRaterSetup ? '/360' : returnPathFor(location.state?.raterType);
  const isTabActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const showBottomNav = !isSurveyOrRaterSetup;

  // 換頁時（Sprint 8 驗收條件 8.8、8.9）：分頁標題改成「頁面名稱｜全方位職能評測」，
  // 多開分頁或看瀏覽紀錄時才分得出來；捲回頁首（React Router 預設保留上一頁的捲動
  // 位置，常常一進新頁面就停在半中間）。網址帶 #錨點時例外，讓錨點自己定位。
  useEffect(() => {
    const name = PAGE_TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1];
    document.title = name ? `${name}｜全方位職能評測` : '全方位職能評測';
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    // 底部導覽與 AI 小幫手浮動按鈕都是 fixed：保留足夠的底部內距，捲到最底時最後一段
    // 內容才不會被它們蓋住（Sprint 8 驗收條件 8.6）。
    <div className={`min-h-screen ${showBottomNav ? 'pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-20' : ''}`}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="flex shrink-0 items-center gap-2 text-base font-extrabold tracking-tight text-slate-800">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <span className="hidden lg:inline">全方位職能評測</span>
            <span className="lg:hidden">職能評測</span>
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
            /* 手機改用畫面底部的 tab bar（見下方 <nav>），這裡只在 sm 以上顯示。
               不換行：寬度真的不夠（sm～lg 之間的平板）時橫向捲動，而不是折成兩行。 */
            <nav aria-label="功能分頁" className="no-scrollbar hidden min-w-0 flex-1 gap-1 overflow-x-auto sm:flex">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={isTabActive(t.path) ? 'page' : undefined}
                  onClick={() => navigate(t.path)}
                  className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isTabActive(t.path)
                      ? 'bg-ink-700 text-paper-50'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="ml-auto shrink-0">
            <UserMenu
              user={user}
              roleLabel={isAdmin ? '管理員' : user.role === 'coach' ? '教練' : null}
              onProfile={() => navigate('/profile')}
              onHelp={() => setHelpOpen(true)}
              manualHref={`${import.meta.env.BASE_URL}user-manual.pdf`}
              onLogout={logout}
            />
          </div>
        </div>
      </header>

      {/* 只包住路由內容，不含頁首與底部導覽——單一頁面出錯時，使用者仍能切換到
          其他分頁自救，而不是整個 App 變白畫面。resetKey 用路徑，換頁即自動復原。 */}
      <ErrorBoundary resetKey={location.pathname}>
      {/* 以第一層路徑當 key：切換功能頁時輕微淡入；同一頁內換參數（例如分析頁切換
          題庫）不重掛元件，保留狀態。 */}
      <div key={location.pathname.split('/')[1] || 'root'} className="animate-page-in">
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

        <Route path="/learning" element={<MyLearningPage />} />

        <Route path="/profile" element={<ProfilePage />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </div>
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
                    active ? 'text-ink-700' : 'text-slate-400 hover:text-slate-600'
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

      {(!isSurveyOrRaterSetup || submittedPath === location.pathname) && (
        <ChatBot context={chatContext} liftForBottomNav={showBottomNav} />
      )}
    </div>
  );
}
