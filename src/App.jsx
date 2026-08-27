import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './survey/auth/AuthContext';
import { useAuth } from './survey/auth/useAuth';
import { api } from './survey/api/client';
import LoginPage from './survey/auth/LoginPage';
import ResetPasswordPage from './survey/auth/ResetPasswordPage';
import AppShell from './survey/AppShell';
import LandingPage from './survey/LandingPage';
import { ToastProvider } from './survey/components/Toast';
import { ConfirmProvider } from './survey/components/ConfirmDialog';
import LoadingState from './survey/components/LoadingState';

// 行銷頁不是首次進站的關鍵路徑（大多數訪客只會看到 LandingPage／登入頁），
// 獨立拆成各自的 chunk，避免 ShowcasePage 引入的圖表元件（雷達圖／熱力圖）
// 灌進每個人都要下載的主要 bundle。
const AboutPage = lazy(() => import('./survey/marketing/AboutPage'));
const HowItWorksPage = lazy(() => import('./survey/marketing/HowItWorksPage'));
const ShowcasePage = lazy(() => import('./survey/marketing/ShowcasePage'));
const FaqPage = lazy(() => import('./survey/marketing/FaqPage'));

const MARKETING_PATHS = ['/about', '/how-it-works', '/showcase', '/faq'];

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
      .catch(() => { /* 代碼無效或已撤銷：忽略，使用者仍可正常使用系統 */ })
      .finally(() => { if (active) setJoinResolved(true); });
    return () => {
      active = false;
    };
  }, [user, joinCode, navigate]);

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

  // 行銷／說明頁（理念、功能總覽、範例報告、常見問題）不論登入與否都能直接用
  // 網址開啟——登入後導覽列的 CTA 會自動改成「前往我的評量」，不強制導回
  // AppShell，讓已登入的使用者也能把連結分享給還沒有帳號的同事。
  if (MARKETING_PATHS.includes(location.pathname)) {
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
        </Routes>
      </Suspense>
    );
  }

  // 忘記密碼重設連結優先（未登入狀態下處理）。
  if (resetToken && !user) {
    return <ResetPasswordPage token={resetToken} onDone={clearReset} />;
  }

  if (!ready || joining) {
    return <LoadingState fullScreen />;
  }
  if (user) return <AppShell />;
  if (view === 'auth' || joinCode) {
    return (
      <LoginPage
        onBack={joinCode ? undefined : () => setView('landing')}
        joinCode={joinCode}
        joinInfo={joinInfo}
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
