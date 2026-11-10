import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { Navbar } from './layouts/Navbar';
import { Sidebar } from './layouts/Sidebar';
import { Footer } from './layouts/Footer';
import { PageBackButton } from './components/common/PageBackButton';
import { CustomerPageMotion } from './components/common/CustomerPageMotion';
import { useAuth } from './context/AuthContext';
import { Atmosphere3DBackground, AtmosphereVariant } from './components/3d/Atmosphere3DBackground';
import './pages/customer/customer-ui.css';

// Route modules load only when their screen is opened. This keeps every page's
// behaviour intact while avoiding the cost of dashboards, charts and forms on
// the first visit to an unrelated screen.
const LandingPage = React.lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const PublicInfoPage = React.lazy(() => import('./pages/PublicInfoPage').then((module) => ({ default: module.PublicInfoPage })));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = React.lazy(() => import('./pages/auth/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));
const ForbiddenPage = React.lazy(() => import('./pages/auth/ForbiddenPage').then((module) => ({ default: module.ForbiddenPage })));
const StoreDashboard = React.lazy(() => import('./pages/store/StoreDashboard').then((module) => ({ default: module.StoreDashboard })));
const StoreDevicesPage = React.lazy(() => import('./pages/store/StoreDevicesPage').then((module) => ({ default: module.StoreDevicesPage })));
const StoreDeviceTemplatesPage = React.lazy(() => import('./pages/store/StoreDeviceTemplatesPage').then((module) => ({ default: module.StoreDeviceTemplatesPage })));
const StoreProductsPage = React.lazy(() => import('./pages/store/StoreProductsPage').then((module) => ({ default: module.StoreProductsPage })));
const StoreRevenuePage = React.lazy(() => import('./pages/store/StoreRevenuePage').then((module) => ({ default: module.StoreRevenuePage })));
const CustomerHomePage = React.lazy(() => import('./pages/customer/CustomerHomePage').then((module) => ({ default: module.CustomerHomePage })));
const CustomerOrdersPage = React.lazy(() => import('./pages/customer/CustomerOrdersPage').then((module) => ({ default: module.CustomerOrdersPage })));
const CustomerRentalsPage = React.lazy(() => import('./pages/customer/CustomerRentalsPage').then((module) => ({ default: module.CustomerRentalsPage })));
const ShopPage = React.lazy(() => import('./pages/customer/ShopPage').then((module) => ({ default: module.ShopPage })));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const QuickSetupPage = React.lazy(() => import('./pages/QuickSetupPage').then((module) => ({ default: module.QuickSetupPage })));
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const CustomerVerificationPage = React.lazy(() => import('./components/customer/CustomerIdentityVerification').then(module => ({ default: module.CustomerIdentityVerification })));
const CustomerBankingPage = React.lazy(() => import('./pages/customer/CustomerBankingPage').then(module => ({ default: module.CustomerBankingPage })));
const StoreFinancePage = React.lazy(() => import('./pages/store/StoreFinancePage').then((module) => ({ default: module.StoreFinancePage })));
const StoreServicePlansPage = React.lazy(() => import('./pages/store/StoreServicePlansPage').then(module => ({ default: module.StoreServicePlansPage })));
const AdminPayoutsPage = React.lazy(() => import('./pages/admin/AdminPayoutsPage').then((module) => ({ default: module.AdminPayoutsPage })));
const AdminRentalActivationPage = React.lazy(() => import('./pages/admin/AdminRentalActivationPanel').then(module => ({ default: module.AdminRentalActivationPage })));
const DriverDeliveryPage = React.lazy(() => import('./pages/operations/DriverDeliveryPage').then(module => ({ default: module.DriverDeliveryPage })));
const DriverShiftManagement = React.lazy(() => import('./pages/operations/DriverShiftManagement').then(module => ({ default: module.DriverShiftPage })));
const PhoneAuthPage = React.lazy(() => import('./pages/auth/PhoneAuthPage').then(module => ({ default: module.PhoneAuthPage })));
const DevicePairingPage = React.lazy(() => import('./pages/customer/DevicePairingPage').then(module => ({ default: module.DevicePairingPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[12rem] w-full flex items-center justify-center" role="status" aria-label="Đang tải nội dung">
    <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#287DA8] border-t-transparent" />
  </div>
);

// Protected Route Wrapper with 403 Forbidden Redirection
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, token, isLoading, refreshToken, sessionError, refreshUser } = useAuth();
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

  if (!token && refreshToken && sessionError) {
    return <main className="mx-auto my-12 max-w-lg rounded-2xl border border-amber-200 bg-white p-6 dark:border-amber-900 dark:bg-zinc-900"><h1 className="text-lg font-bold">Đang chờ máy chủ</h1><p role="status" className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{sessionError}</p><button type="button" onClick={() => void refreshUser()} className="mt-5 min-h-11 rounded-xl bg-[#287DA8] px-4 py-2 text-sm font-semibold text-white">Thử kết nối lại</button></main>;
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
  const { user } = useAuth();

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] w-full bg-[#FBFBFC] dark:bg-zinc-950 relative">
      <Sidebar />
      <main className="app-workspace flex-1 min-w-0 w-full p-3 sm:p-5 lg:p-6">
        {['CUSTOMER', 'STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role || '') && (
          <nav aria-label="Điều hướng trang" className="mb-3 flex sm:mb-4">
            <PageBackButton />
          </nav>
        )}
        <Suspense fallback={<RouteLoadingFallback />}>
          {user?.role === 'CUSTOMER'
            ? <CustomerPageMotion>{children || <Outlet />}</CustomerPageMotion>
            : children || <Outlet />}
        </Suspense>
      </main>
    </div>
  );
};

// These profile routes sit outside AppShellLayout, so supply their back control once.
const StandaloneProfileBackNavigation: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role || '');
  const isStoreUser = ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user?.role || '');
  if (!isAdmin && !isStoreUser) return null;

  return (
    <nav aria-label="Điều hướng trang" className="mx-auto flex max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
      <PageBackButton fallbackTo={isAdmin ? '/admin/dashboard' : '/store/dashboard'} />
    </nav>
  );
};

const DriverBackNavigation: React.FC = () => {
  const { user } = useAuth();
  const fallback = ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user?.role || '') ? '/admin/dashboard' : ['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role || '') ? '/store/dashboard' : '/profile';
  return <nav className="mx-auto max-w-6xl px-4 pt-4 sm:px-6" aria-label="Điều hướng giao hàng"><PageBackButton fallbackTo={fallback} /></nav>;
};

export const App: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Route-aware 3D atmosphere variant (Specifications 36.1, 36.9, 36.10, 36.11)
  const getAtmosphereVariant = (): AtmosphereVariant => {
    const p = location.pathname;
    if (p === '/') return 'hero';
    if (p.startsWith('/login') || p.startsWith('/register') || p.startsWith('/phone-auth') || p.startsWith('/forgot-password') || p.startsWith('/reset-password') || p.startsWith('/verify-email')) {
      return 'auth';
    }
    if (p === '/quick-setup') return 'device-config';
    if (p.startsWith('/store') || p.startsWith('/customer') || p.startsWith('/admin') || p.startsWith('/driver/')) {
      return 'dashboard';
    }
    return 'hero';
  };

  const isDashboard = location.pathname.startsWith('/store') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/driver/');
  const isAuth = ['/login', '/register', '/phone-auth', '/forgot-password', '/reset-password', '/verify-email', '/403'].includes(location.pathname);
  const showFooter = !isDashboard && !isAuth;

  return (
    <div className={`min-h-screen bg-surface-bg dark:bg-cyber-bg text-navy-900 dark:text-slate-100 flex flex-col transition-colors duration-200 relative overflow-x-hidden ${location.pathname === '/' ? 'landing-route' : ''}`}>
      {/* 36. Animated Background — Premium 3D Atmosphere */}
      <Atmosphere3DBackground variant={getAtmosphereVariant()} />
      {!isAuth && <Navbar />}
      <div className={`app-content flex-1 min-w-0 relative ${location.pathname === "/" || isAuth ? "" : "pt-16"}`}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/help/:slug" element={<PublicInfoPage />} />
          <Route path="/policies/:slug" element={<PublicInfoPage />} />
          <Route
            path="/shop"
            element={user?.role === 'CUSTOMER' ? <AppShellLayout><ShopPage /></AppShellLayout> : <ShopPage />}
          />
          <Route path="/quick-setup" element={<QuickSetupPage />} />
          <Route path="/login" element={<LoginPage initialMode="login" />} />
          <Route path="/register" element={<RegisterPage initialMode="register" />} />
          <Route path="/phone-auth" element={<PhoneAuthPage />} />
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
            <Route path="/store/rentals" element={user?.role === 'STORE_OWNER' ? <Navigate to="/store/service-plans" replace /> : <CustomerRentalsPage />} />
            <Route path="/store/service-plans" element={<ProtectedRoute allowedRoles={['STORE_OWNER']}><StoreServicePlansPage /></ProtectedRoute>} />
            <Route path="/store/device-templates" element={<StoreDeviceTemplatesPage />} />
            <Route path="/store/products" element={<StoreProductsPage />} />
            <Route path="/store/analytics" element={<StoreRevenuePage />} />
            <Route path="/store/wallet" element={<Navigate to="/store/analytics?tab=WALLET" replace />} />
            <Route path="/store/finance" element={<ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER']}><StoreFinancePage /></ProtectedRoute>} />
          </Route>

          {/* Standalone Store Profile Route (No Trạm Điều Hành sidebar) */}
          <Route
            path="/store/profile"
            element={
              <ProtectedRoute allowedRoles={['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF']}>
                <>
                  <StandaloneProfileBackNavigation />
                  <ProfilePage />
                </>
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
            <Route path="/customer/pair-device" element={<DevicePairingPage />} />
            <Route path="/customer/rentals" element={<CustomerRentalsPage />} />
            <Route path="/customer/orders" element={<CustomerOrdersPage />} />
            <Route path="/customer/verification" element={<CustomerVerificationPage />} />
            <Route path="/customer/banking" element={<CustomerBankingPage />} />
            <Route path="/customer/profile" element={<ProfilePage />} />
          </Route>

          <Route
            path="/driver/shifts"
            element={
              <ProtectedRoute allowedRoles={['STAFF_DELIVERY', 'STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER', 'SUPER_ADMIN', 'SYSTEM_ADMIN']}>
                <><DriverBackNavigation /><DriverShiftManagement /></>
              </ProtectedRoute>
            }
          />
          <Route path="/driver/deliveries" element={<ProtectedRoute allowedRoles={['STAFF_DELIVERY', 'STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER', 'SUPER_ADMIN', 'SYSTEM_ADMIN']}><DriverBackNavigation /><DriverDeliveryPage /></ProtectedRoute>} />
          {/* Admin routes share the same collapsible desktop sidebar. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']}>
                <AppShellLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/payouts" element={<AdminPayoutsPage />} />
            <Route path="/admin/identity" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/rental-activation" element={<AdminRentalActivationPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
          </Route>

          {/* Universal Authenticated Profile Route */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                {user?.role === 'CUSTOMER'
                  ? <AppShellLayout><ProfilePage /></AppShellLayout>
                  : <><StandaloneProfileBackNavigation /><ProfilePage /></>}
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {showFooter && <Footer />}
    </div>
  );
};
