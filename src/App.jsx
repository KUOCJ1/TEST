import { AuthProvider } from './survey/auth/AuthContext';
import { useAuth } from './survey/auth/useAuth';
import LoginPage from './survey/auth/LoginPage';
import AppShell from './survey/AppShell';

function Routes() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <AppShell /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
