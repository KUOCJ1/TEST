import { AuthProvider, useAuth } from './context/AuthContext';
import { CalendarProvider } from './context/CalendarContext';
import { GroupProvider } from './context/GroupContext';
import AuthPage from './pages/AuthPage';
import CalendarPage from './pages/CalendarPage';

function AppContent() {
  const { currentUser } = useAuth();

  if (!currentUser) return <AuthPage />;

  return (
    <CalendarProvider userId={currentUser.id}>
      <GroupProvider currentUser={currentUser}>
        <CalendarPage />
      </GroupProvider>
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
