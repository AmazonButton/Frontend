import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { SoundProvider } from './context/OrderSoundContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { ToastProvider } from './context/ToastContext';
import { App } from './App';
import { initGlobalModalScrollLock } from './hooks/useBodyScrollLock';
import { isModuleLoadError, recoverModuleLoad } from './services/module-recovery';
import './index.css';

window.addEventListener('vite:preloadError', (event: Event) => {
  // Keep the rejection visible to React so failed recovery has a retry screen.
  void recoverModuleLoad((event as Event & { payload: unknown }).payload);
});

// Automatically lock background scrolling whenever any modal/popup is open
initGlobalModalScrollLock();

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '999999999999-placeholder0000000000000000000.apps.googleusercontent.com';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; recovering: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Suppress benign third-party DOM extension conflicts (e.g. Chrome Translate, Built-in AI)
    if (
      error.message?.includes('removeChild') ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('not a child of this node')
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error, recovering: isModuleLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isModuleLoadError(error)) {
      void recoverModuleLoad(error).then(reloaded => {
        if (!reloaded) this.setState({ recovering: false });
      });
      return;
    }
    if (
      error.message?.includes('removeChild') ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('not a child of this node')
    ) {
      console.warn('[ErrorBoundary] Ignored benign DOM mutation from browser extension:', error.message);
      return;
    }
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isModuleLoadError(this.state.error) ? 'Chưa tải được trang' : 'Đã xảy ra lỗi hiển thị'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
              {this.state.recovering
                ? 'Đang kiểm tra và tải lại phiên bản mới. Vui lòng chờ trong giây lát…'
                : isModuleLoadError(this.state.error)
                  ? 'Kết nối có thể bị gián đoạn hoặc trang vừa được cập nhật. Hãy kiểm tra mạng rồi thử tải lại.'
                  : 'Không thể hiển thị nội dung lúc này. Vui lòng thử tải lại trang.'}
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                disabled={this.state.recovering}
                className="px-4 py-2 bg-[#287DA8] hover:bg-[#20668a] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root') as HTMLElement;
// Cache root in development to prevent duplicate createRoot warnings on Vite HMR
const root = (window as any).__reactRoot || ReactDOM.createRoot(rootElement);
(window as any).__reactRoot = root;

const appTree = (
  <ErrorBoundary>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <SoundProvider>
              <SidebarProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </SidebarProvider>
            </SoundProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </ErrorBoundary>
);

// Only enable StrictMode double-effect checks when explicitly opted in via VITE_STRICT_MODE=true,
// preventing duplicated API calls and double-mount latency during local development.
root.render(
  import.meta.env.VITE_STRICT_MODE === 'true' ? <React.StrictMode>{appTree}</React.StrictMode> : appTree
);
