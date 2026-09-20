import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './layouts/Navbar';
import { Sidebar } from './layouts/Sidebar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForbiddenPage } from './pages/auth/ForbiddenPage';
import { StoreDashboard } from './pages/store/StoreDashboard';
import { StoreDevicesPage } from './pages/store/StoreDevicesPage';
import { StoreDeviceTemplatesPage } from './pages/store/StoreDeviceTemplatesPage';
import { StoreProductsPage } from './pages/store/StoreProductsPage';
import { CustomerHomePage } from './pages/customer/CustomerHomePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSecurityHubPage } from './pages/admin/AdminSecurityHubPage';
import { QuickSetupPage } from './pages/QuickSetupPage';
import { useAuth } from './context/AuthContext';
import { Atmosphere3DBackground, AtmosphereVariant } from './components/3d/Atmosphere3DBackground';

// Protected Route Wrapper with 403 Forbidden Redirection
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-medium">Đang khởi tạo phiên làm việc an toàn...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

// Store Shell Layout (with Sidebar)
const StoreLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl">{children}</main>
    </div>
  );
};

export const App: React.FC = () => {
  const location = useLocation();

  // Route-aware 3D atmosphere variant (Specifications 36.1, 36.9, 36.10, 36.11)
  const getAtmosphereVariant = (): AtmosphereVariant => {
    const p = location.pathname;
    if (p === '/') return 'hero';
    if (p.startsWith('/login') || p.startsWith('/register') || p.startsWith('/forgot-password') || p.startsWith('/reset-password') || p.startsWith('/verify-email')) {
      return 'auth';
    }
    if (p === '/quick-setup') return 'device-config';
    if (p.startsWith('/store') || p.startsWith('/customer') || p.startsWith('/admin')) {
      return 'dashboard';
    }
    return 'hero';
  };

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-cyber-bg text-navy-900 dark:text-slate-100 flex flex-col transition-colors duration-200 relative overflow-x-hidden">
      {/* 36. Animated Background — Premium 3D Atmosphere */}
      <Atmosphere3DBackground variant={getAtmosphereVariant()} />
      <Navbar />
      <div className="flex-1 relative z-10">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/quick-setup" element={<QuickSetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          {/* Store Routes */}
          <Route
            path="/store/dashboard"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <StoreLayout>
                  <StoreDashboard />
                </StoreLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/devices"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <StoreLayout>
                  <StoreDevicesPage />
                </StoreLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/device-templates"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <StoreLayout>
                  <StoreDeviceTemplatesPage />
                </StoreLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/products"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <StoreLayout>
                  <StoreProductsPage />
                </StoreLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/analytics"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <StoreLayout>
                  <StoreDashboard />
                </StoreLayout>
              </ProtectedRoute>
            }
          />

          {/* Customer Routes */}
          <Route
            path="/customer/home"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <CustomerHomePage />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/security/devices"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AdminSecurityHubPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};
