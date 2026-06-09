import { AuthProvider, useAuth } from './context/AuthContext';
import { CalendarProvider } from './context/CalendarContext';
import AuthPage from './pages/AuthPage';
import CalendarPage from './pages/CalendarPage';

function AppContent() {
  const { currentUser } = useAuth();

  if (!currentUser) return <AuthPage />;

  return (
    <CalendarProvider userId={currentUser.id}>
      <CalendarPage />
    </CalendarProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
