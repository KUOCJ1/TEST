import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider } from './survey/auth/AuthContext';
import { useAuth } from './survey/auth/useAuth';
import { api } from './survey/api/client';
import LoginPage from './survey/auth/LoginPage';
import ResetPasswordPage from './survey/auth/ResetPasswordPage';
import AppShell from './survey/AppShell';
import LandingPage from './survey/LandingPage';
import { ToastProvider } from './survey/components/Toast';

function readResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('reset');
}

function readJoinCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('join');
}

function Routes() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
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

  // 忘記密碼重設連結優先（未登入狀態下處理）。
  if (resetToken && !user) {
    return <ResetPasswordPage token={resetToken} onDone={clearReset} />;
  }

  if (!ready || joining) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">載入中…</div>;
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
        <Routes />
      </ToastProvider>
    </AuthProvider>
  );
}
