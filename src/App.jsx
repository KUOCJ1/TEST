import { useState } from 'react';
import { AuthProvider } from './survey/auth/AuthContext';
import { useAuth } from './survey/auth/useAuth';
import LoginPage from './survey/auth/LoginPage';
import ResetPasswordPage from './survey/auth/ResetPasswordPage';
import AppShell from './survey/AppShell';
import LandingPage from './survey/LandingPage';

function readResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('reset');
}

function Routes() {
  const { user, ready } = useAuth();
  const [resetToken, setResetToken] = useState(readResetToken);
  const [view, setView] = useState('landing');

  const clearReset = () => {
    setResetToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // 忘記密碼重設連結優先（未登入狀態下處理）。
  if (resetToken && !user) {
    return <ResetPasswordPage token={resetToken} onDone={clearReset} />;
  }

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">載入中…</div>;
  }
  if (user) return <AppShell />;
  if (view === 'auth') return <LoginPage onBack={() => setView('landing')} />;
  return <LandingPage onEnter={() => setView('auth')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
