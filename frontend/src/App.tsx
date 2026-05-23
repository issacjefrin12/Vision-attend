import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuthStore } from './store/authStore';
import { DashboardLayout } from './components/layout';
import {
  Login,
  Dashboard,
  Attendance,
  Students,
  Analytics,
  MyAttendance,
  MyCourses,
  Profile,
  Courses,
  Users,
  Settings,
  ResetPassword,
  LeaveApprovals,
  LeaveRequests,
  MarkSession,
  Timetable,
  UploadDepartments,
  UploadClasses,
  UploadStudents,
  UploadTimetable,
  ClassSetup,
  ClassLocation,
  UploadFaculty,
  UploadCourses,
} from './pages';

const queryClient = new QueryClient();

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Role-based route protection
const RoleRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: ('admin' | 'faculty' | 'student')[];
}> = ({ children, allowedRoles }) => {
  const { user } = useAuthStore();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="timetable" element={<Timetable />} />

            {/* Admin & Faculty routes */}
            <Route
              path="attendance"
              element={
                <RoleRoute allowedRoles={['admin', 'faculty']}>
                  <Attendance />
                </RoleRoute>
              }
            />
            <Route
              path="students"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Students />
                </RoleRoute>
              }
            />
            <Route
              path="analytics"
              element={
                <RoleRoute allowedRoles={['admin', 'faculty']}>
                  <Analytics />
                </RoleRoute>
              }
            />
            <Route
              path="leave-approvals"
              element={
                <RoleRoute allowedRoles={['admin', 'faculty']}>
                  <LeaveApprovals />
                </RoleRoute>
              }
            />
            <Route
              path="enroll"
              element={
                <RoleRoute allowedRoles={['admin', 'faculty']}>
                  <Attendance />
                </RoleRoute>
              }
            />
            <Route
              path="courses"
              element={
                <RoleRoute allowedRoles={['admin', 'faculty']}>
                  <Courses />
                </RoleRoute>
              }
            />
            <Route
              path="class-setup"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <ClassSetup />
                </RoleRoute>
              }
            />
            <Route
              path="class-location"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <ClassLocation />
                </RoleRoute>
              }
            />

            {/* Admin only routes */}
            <Route
              path="users"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Users />
                </RoleRoute>
              }
            />
            <Route
              path="settings"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Settings />
                </RoleRoute>
              }
            />
            <Route
              path="upload-departments"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadDepartments />
                </RoleRoute>
              }
            />
            <Route
              path="upload-classes"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadClasses />
                </RoleRoute>
              }
            />
            <Route
              path="upload-students"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadStudents />
                </RoleRoute>
              }
            />
            <Route
              path="upload-timetable"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadTimetable />
                </RoleRoute>
              }
            />
            <Route
              path="upload-faculty"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadFaculty />
                </RoleRoute>
              }
            />
            <Route
              path="upload-courses"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <UploadCourses />
                </RoleRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="my-attendance"
              element={
                <RoleRoute allowedRoles={['student']}>
                  <MyAttendance />
                </RoleRoute>
              }
            />
            <Route
              path="my-courses"
              element={
                <RoleRoute allowedRoles={['student']}>
                  <MyCourses />
                </RoleRoute>
              }
            />
            <Route
              path="leave-requests"
              element={
                <RoleRoute allowedRoles={['student']}>
                  <LeaveRequests />
                </RoleRoute>
              }
            />
            <Route
              path="mark-session"
              element={
                <RoleRoute allowedRoles={['student']}>
                  <MarkSession />
                </RoleRoute>
              }
            />

            {/* Common routes */}
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
