import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Transactions from './pages/Transactions';
import AIAssistant from './pages/AIAssistant';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import GmailExpenses from './pages/GmailExpenses';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected app routes */}
      <Route path="/" element={
        <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
      }/>
      <Route path="/goals" element={
        <ProtectedRoute><Layout><Goals /></Layout></ProtectedRoute>
      }/>
      <Route path="/transactions" element={
        <ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>
      }/>
      <Route path="/ai-assistant" element={
        <ProtectedRoute><Layout><AIAssistant /></Layout></ProtectedRoute>
      }/>
      <Route path="/notifications" element={
        <ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>
      }/>
      <Route path="/settings" element={
        <ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>
      }/>
      <Route path="/gmail-expenses" element={
        <ProtectedRoute><Layout><GmailExpenses /></Layout></ProtectedRoute>
      }/>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
