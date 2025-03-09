import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import SetUsername from './pages/SetUsername';
import Chat from './pages/Chat';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.username) {
    return <Navigate to="/set-username" />;
  }

  return children;
}

// Public Route Component
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
    </div>;
  }

  if (user?.username) {
    return <Navigate to="/" />;
  } else if (user && !user.username) {
    return <Navigate to="/set-username" />;
  }

  return children;
}

// Username Setup Route Component
function UsernameRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.username) {
    return <Navigate to="/" />;
  }

  return children;
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              duration: 3000,
              theme: {
                primary: '#4aed88',
              },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/set-username" element={
            <UsernameRoute>
              <SetUsername />
            </UsernameRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
