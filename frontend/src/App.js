import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PageStateProvider } from './context/PageStateContext';
import { NotificationProvider } from './context/NotificationContext';
import { CacheProvider } from './context/CacheContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n'; // Initialize i18n

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import DebugAuthPage from './pages/DebugAuthPage';
import TestLoginPage from './pages/TestLoginPage';
import SimpleTestPage from './pages/SimpleTestPage';
import MinimalDashboard from './pages/MinimalDashboard';
import DashboardPage from './pages/DashboardPage';
import FacultyPage from './pages/FacultyPage';
import FacultySignupPage from './pages/FacultySignupPage';
import FacultyApprovalPage from './pages/FacultyApprovalPage';
import SubjectPage from './pages/SubjectPage';
import RoomPage from './pages/RoomPage';
import SchedulePage from './pages/SchedulePage';
import SectionPage from './pages/SectionPage';
import ClassSpacePage from './pages/ClassSpacePage';
import StudentPage from './pages/StudentPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import FacultyAnalyticsPage from './pages/FacultyAnalyticsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import SettingsPage from './pages/SettingsPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import NotFoundPage from './pages/NotFoundPage';
import TermsPage from './pages/TermsPage';
import TermsGate from './components/TermsGate';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CacheProvider>
          <PageStateProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NotificationProvider>
            <div className="min-h-screen bg-gray-50">
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#363636',
                  color: '#fff',
                  zIndex: 999999, // Ensure toasts appear above ALL modals
                },
                success: {
                  duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
            containerStyle={{
              zIndex: 999999, // Container also needs high z-index to appear above modals
            }}
          />
          <TermsGate />
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/simple-test" element={<SimpleTestPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/test-login" element={<TestLoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/faculty-signup" element={<FacultySignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
            <Route path="/debug-auth" element={<DebugAuthPage />} />
            <Route path="/dashboard-test" element={<DashboardPage />} />
            <Route path="/dashboard-minimal" element={<MinimalDashboard />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <FacultyPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty/approvals" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <FacultyApprovalPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/subjects" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <SubjectPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rooms" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <RoomPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/schedules" 
              element={
                <ProtectedRoute>
                  <SchedulePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sections" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <SectionPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/classes" 
              element={
                <ProtectedRoute>
                  <ClassSpacePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/classes/:classSlug" 
              element={
                <ProtectedRoute>
                  <ClassSpacePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/students" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <StudentPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <AnalyticsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty-analytics" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <FacultyAnalyticsPage />
                </ProtectedRoute>
              } 
            />
            {/* Old AI Insights address */}
            <Route path="/ai" element={<Navigate to="/faculty-analytics" replace />} />
            <Route 
              path="/activity" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'scheduling_officer', 'program_manager']}>
                  <ActivityLogPage />
                </ProtectedRoute>
              } 
            />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ErrorBoundary>
        </div>
      </NotificationProvider>
      </Router>
      </PageStateProvider>
        </CacheProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
