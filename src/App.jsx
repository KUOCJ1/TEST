import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './survey/auth/AuthContext';
import { useAuth } from './survey/auth/useAuth';
import { api } from './survey/api/client';
import LoginPage from './survey/auth/LoginPage';
import ResetPasswordPage from './survey/auth/ResetPasswordPage';
import LandingPage from './survey/LandingPage';
import { ToastProvider } from './survey/components/Toast';
import { useToast } from './survey/components/useToast';
import { ConfirmProvider } from './survey/components/ConfirmDialog';
import LoadingState from './survey/components/LoadingState';
import ConsentGate from './survey/legal/ConsentGate';
import { needsConsentGate } from './survey/legal/policy';

// 行銷頁不是首次進站的關鍵路徑（大多數訪客只會看到 LandingPage／登入頁），
// 獨立拆成各自的 chunk，避免 ShowcasePage 引入的圖表元件（雷達圖／熱力圖）
// 灌進每個人都要下載的主要 bundle。
const AboutPage = lazy(() => import('./survey/marketing/AboutPage'));
const HowItWorksPage = lazy(() => import('./survey/marketing/HowItWorksPage'));
const ShowcasePage = lazy(() => import('./survey/marketing/ShowcasePage'));
const FaqPage = lazy(() => import('./survey/marketing/FaqPage'));
const LegalPage = lazy(() => import('./survey/marketing/LegalPage'));
const FrameworkPage = lazy(() => import('./survey/marketing/FrameworkPage'));
const GuidePage = lazy(() => import('./survey/marketing/GuidePage'));

// AppShell（整個已登入後的系統：作答、雷達圖、教練／管理後台）過去是靜態 import，
// 跟 LandingPage／LoginPage 綁在一起，導致每個訪客（含還沒登入、只是看首頁的人）
// 都得下載雷達圖、題庫資料、OnboardingBanner 等登入後才用得到的程式碼。改成
// lazy() 之後這些只在真的登入成功、掛載 AppShell 時才下載。
const AppShell = lazy(() => import('./survey/AppShell'));

// '/welcome'：登入後也能回到首頁（行銷首頁）；'/' 對已登入的人是 AppShell（會導到我的評量或預設評量）。
const MARKETING_PATHS = ['/about', '/how-it-works', '/showcase', '/faq', '/privacy', '/terms', '/framework', '/welcome'];
// 各評測的說明頁（/guide/:評量 id）是動態路徑，另外以前綴判斷。
const isMarketingPath = (p) => MARKETING_PATHS.includes(p) || p.startsWith('/guide/');

function MarketingFallback() {
  return <LoadingState fullScreen />;
}

function readResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('reset');
}

function readJoinCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('join');
}

// 邀請連結（Sprint 19）：?invite=邀請碼。每位學員一組專屬連結，綁定 Email、14 天有效、只能用一次。
function readInviteCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('invite');
}

const MARKETING_TITLES = {
  '/about': '平台理念', '/how-it-works': '功能總覽', '/showcase': '範例報告', '/faq': '常見問題',
  '/privacy': '隱私權政策', '/terms': '服務條款', '/framework': '領導力羅盤八向評測', '/welcome': '首頁',
};

function AppRoutes() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [resetToken, setResetToken] = useState(readResetToken);
  const [view, setView] = useState('landing');
  const [joinCode] = useState(readJoinCode);
  // null＝讀取中或無代碼；'invalid'＝代碼失效；否則為 { groupName, assessmentId, ... }
  const [joinInfo, setJoinInfo] = useState(null);
  const [joinResolved, setJoinResolved] = useState(false);
  const joining = Boolean(user && joinCode && !joinResolved);

  // 邀請連結：未登入時先查「誰邀請你加入哪個班」（null＝讀取中；{ error, code }＝失效；否則為邀請資訊）。
  const [inviteCode] = useState(readInviteCode);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteResult, setInviteResult] = useState(null); // LoginPage 用邀請碼註冊／登入後回報
  const [inviteResolved, setInviteResolved] = useState(false);
  const openedLoggedIn = useRef(null);
  const showToast = useToast();
  const inviting = Boolean(user && inviteCode && !inviteResolved);

  const clearReset = () => {
    setResetToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // 使用者只要「已登入」且網址帶著報到代碼，就自動加入該班並導向作答頁——不論這個
  // 登入狀態是剛才用 LoginPage 表單註冊/登入拿到的，還是原本就已登入、現在才掃到
  // （另一個）班級的 QR，統一走這一條路徑處理，不在 LoginPage 裡另外自己 navigate。
  // 註冊/登入時 API 本身已經帶 joinCode 把人加進班了，這裡的 api.joinGroup() 在那種
  // 情況下只是再確認一次（冪等、不會重複加入），主要目的是拿到 assessmentId 來導頁。
  // 關鍵是：一定要等這裡 navigate() 真的换到目標網址之後（joinResolved 才會變
  // true），才讓下面把 <AppShell/> 掛載出來——不然 AppShell 自己的預設路由（對還沒
  // 换成目標路徑的網址做重導）會搶在前面把使用者導去 /home。
  useEffect(() => {
    if (!user || !joinCode) return undefined;
    let active = true;
    api
      .joinGroup(joinCode)
      .then((joinedGroup) => {
        if (!active) return;
        navigate(`/survey/${joinedGroup.assessmentId}`, { replace: true });
      })
      .catch((e) => {
        // 代碼無效或已撤銷：忽略，使用者仍可正常使用系統；但「限定網域／名額已滿」要告訴使用者原因。
        if (e?.code === 'JOIN_EMAIL_NOT_ALLOWED' || e?.code === 'CLASS_FULL') showToast(e.message, 'error');
      })
      .finally(() => { if (active) setJoinResolved(true); });
    return () => {
      active = false;
    };
  }, [user, joinCode, navigate, showToast]);

  // 未登入時先查一次班級資訊，用於 LoginPage 上方的橫幅。
  useEffect(() => {
    if (user || !joinCode) return undefined;
    let active = true;
    api
      .publicJoinInfo(joinCode)
      .then((info) => active && setJoinInfo(info))
      .catch(() => active && setJoinInfo('invalid'));
    return () => {
      active = false;
    };
  }, [user, joinCode]);

  // 邀請連結的處理（Sprint 19）：
  //  - 開連結時「已經登入」：直接用邀請碼兌換（Email 要和邀請相符，不符會說明原因）。
  //  - 開連結時未登入：LoginPage 用邀請碼註冊／登入，結果由 handleInviteResult 帶回來，這裡負責導頁。
  //  - 邀請已失效（LoginPage 沒有帶碼）：登入後沒有東西要處理，直接放行。
  useEffect(() => {
    if (ready && openedLoggedIn.current === null) openedLoggedIn.current = Boolean(user);
  }, [ready, user]);

  useEffect(() => {
    if (user || !inviteCode) return undefined;
    let active = true;
    api
      .publicInviteInfo(inviteCode)
      .then((info) => active && setInviteInfo(info))
      .catch((e) => active && setInviteInfo({ error: e.message || '邀請無法使用', code: e.code }));
    return () => { active = false; };
  }, [user, inviteCode]);

  useEffect(() => {
    if (!user || !inviteCode || inviteResolved) return undefined;
    let active = true;
    const done = () => {
      if (!active) return;
      window.history.replaceState({}, '', window.location.pathname);
      setInviteResolved(true);
    };
    const go = (joinedGroup) => navigate(`/survey/${joinedGroup.assessmentId}`, { replace: true });
    if (openedLoggedIn.current === true) {
      api.redeemInvite(inviteCode)
        .then((g) => { if (active) go(g); })
        .catch((e) => showToast(e.message || '加入班級失敗', 'error'))
        .finally(done);
    } else if (inviteResult) {
      if (inviteResult.joinedGroup) go(inviteResult.joinedGroup);
      else if (inviteResult.inviteError) showToast(inviteResult.inviteError.error, 'error');
      done();
    } else if (inviteInfo?.error) {
      done();
    }
    return () => { active = false; };
  }, [user, inviteCode, inviteResolved, inviteResult, inviteInfo, navigate, showToast]);

  // 分頁標題（Sprint 8 驗收條件 8.8）：只管行銷頁與未登入畫面；登入後由 AppShell
  // 依功能頁設定——effect 是子元件先跑，這裡若也寫就會把 AppShell 的蓋掉。
  const isMarketing = isMarketingPath(location.pathname);
  useEffect(() => {
    if (user && !isMarketing) return;
    const name = MARKETING_TITLES[location.pathname] ?? (location.pathname.startsWith('/guide/') ? '評測說明' : null) ?? (!user && view === 'auth' ? '登入／註冊' : null);
    document.title = name ? `${name}｜全方位職能評測` : '全方位職能評測｜職能評量與發展平台';
  }, [user, isMarketing, location.pathname, view]);

  // 行銷／說明頁（理念、功能總覽、範例報告、常見問題）不論登入與否都能直接用
  // 網址開啟——登入後導覽列的 CTA 會自動改成「前往我的評量」，不強制導回
  // AppShell，讓已登入的使用者也能把連結分享給還沒有帳號的同事。
  if (isMarketingPath(location.pathname)) {
    // 登入畫面目前是首頁的一個 view 狀態，不是獨立路由，所以由行銷頁觸發登入時
    // 要先導回首頁，再切換到 view === 'auth'，下一次渲染才會顯示 LoginPage。
    const enterLogin = () => {
      navigate('/');
      setView('auth');
    };
    return (
      <Suspense fallback={<MarketingFallback />}>
        <Routes>
          <Route path="/about" element={<AboutPage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/how-it-works" element={<HowItWorksPage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/showcase" element={<ShowcasePage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/faq" element={<FaqPage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/terms" element={<LegalPage kind="terms" loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/welcome" element={<LandingPage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/framework" element={<FrameworkPage loggedIn={!!user} onEnter={enterLogin} />} />
          <Route path="/guide/:assessmentId" element={<GuidePage loggedIn={!!user} onEnter={enterLogin} />} />
        </Routes>
      </Suspense>
    );
  }

  // 忘記密碼重設連結優先（未登入狀態下處理）。
  if (resetToken && !user) {
    return <ResetPasswordPage token={resetToken} onDone={clearReset} />;
  }

  if (!ready || joining || inviting) {
    return <LoadingState fullScreen />;
  }
  // 還沒同意目前版本政策的既有用戶：先看到同意畫面（政策還是草稿時不擋，見 legal/policy.js）。
  if (user && needsConsentGate(user)) return <ConsentGate />;
  if (user) {
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <AppShell />
      </Suspense>
    );
  }
  if (view === 'auth' || joinCode || inviteCode) {
    return (
      <LoginPage
        onBack={joinCode || inviteCode ? undefined : () => setView('landing')}
        joinCode={joinCode}
        joinInfo={joinInfo}
        inviteCode={inviteCode}
        inviteInfo={inviteInfo}
        onInviteResult={setInviteResult}
      />
    );
  }
  return <LandingPage onEnter={() => setView('auth')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
