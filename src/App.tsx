import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { Navbar } from './layouts/Navbar';
import { Sidebar } from './layouts/Sidebar';
import { Footer } from './layouts/Footer';
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
import { StoreWalletPage } from './pages/store/StoreWalletPage';
import { StoreAnalyticsPage } from './pages/store/StoreAnalyticsPage';
import { CustomerHomePage } from './pages/customer/CustomerHomePage';
import { CustomerOrdersPage } from './pages/customer/CustomerOrdersPage';
import { ShopPage } from './pages/customer/ShopPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSecurityHubPage } from './pages/admin/AdminSecurityHubPage';
import { QuickSetupPage } from './pages/QuickSetupPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { AdminPayoutsPage, CustomerVerificationPage, DriverShiftPage, StoreFinancePage } from './pages/operations/OperationsPages';
import { useAuth } from './context/AuthContext';
import { Atmosphere3DBackground, AtmosphereVariant } from './components/3d/Atmosphere3DBackground';

// Protected Route Wrapper with 403 Forbidden Redirection
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, token, isLoading } = useAuth();
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

  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

// Shared desktop shell. The sidebar keeps navigation available while its compact
// state gives every role the same full-width workspace as the store owner.
const AppShellLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-[#FBFBFC] dark:bg-zinc-950 relative">
      <Sidebar />
      <main className="flex-1 min-w-0 w-full p-4 sm:p-5 lg:p-6 overflow-x-hidden">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

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

  const isDashboard = location.pathname.startsWith('/store') || location.pathname.startsWith('/admin');
  const isAuth = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/403'].includes(location.pathname);
  const showFooter = !isDashboard && !isAuth;

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-cyber-bg text-navy-900 dark:text-slate-100 flex flex-col transition-colors duration-200 relative overflow-x-hidden">
      {/* 36. Animated Background — Premium 3D Atmosphere */}
      <Atmosphere3DBackground variant={getAtmosphereVariant()} />
      {!isAuth && <Navbar />}
      <div className={`flex-1 relative ${location.pathname === "/" || isAuth ? "" : "pt-16"} ${user?.role === "CUSTOMER" && !isAuth ? "pb-16 md:pb-0" : ""}`}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/shop"
            element={user?.role === 'CUSTOMER' ? <AppShellLayout><ShopPage /></AppShellLayout> : <ShopPage />}
          />
          <Route path="/quick-setup" element={<QuickSetupPage />} />
          <Route path="/login" element={<LoginPage initialMode="login" />} />
          <Route path="/register" element={<RegisterPage initialMode="register" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          {/* Store Routes with Persistent Shared Sidebar */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <AppShellLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/store" element={<Navigate to="/store/dashboard" replace />} />
            <Route path="/store/dashboard" element={<StoreDashboard />} />
            <Route path="/store/devices" element={<StoreDevicesPage />} />
            <Route path="/store/device-templates" element={<StoreDeviceTemplatesPage />} />
            <Route path="/store/products" element={<StoreProductsPage />} />
            <Route path="/store/analytics" element={<StoreAnalyticsPage />} />
            <Route path="/store/wallet" element={<StoreWalletPage />} />
            <Route path="/store/finance" element={<ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER']}><StoreFinancePage /></ProtectedRoute>} />
          </Route>

          {/* Standalone Store Profile Route (No Trạm Điều Hành sidebar) */}
          <Route
            path="/store/profile"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Customer routes share the collapsible desktop sidebar. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <AppShellLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/customer/home" element={<CustomerHomePage />} />
            <Route path="/customer/orders" element={<CustomerOrdersPage />} />
            <Route path="/customer/verification" element={<CustomerVerificationPage />} />
            <Route path="/customer/profile" element={<ProfilePage />} />
          </Route>

          <Route
            path="/driver/shifts"
            element={
              <ProtectedRoute allowedRoles={['STAFF_DELIVERY']}>
                <DriverShiftPage />
              </ProtectedRoute>
            }
          />
          {/* Admin routes share the same collapsible desktop sidebar. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']}>
                <AppShellLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/security/devices" element={<AdminSecurityHubPage />} />
            <Route path="/admin/payouts" element={<AdminPayoutsPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
          </Route>

          {/* Universal Authenticated Profile Route */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showFooter && <Footer />}
    </div>
  );
};
