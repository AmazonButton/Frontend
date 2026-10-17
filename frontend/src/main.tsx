import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SoundProvider } from './context/OrderSoundContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { ToastProvider } from './context/ToastContext';
import { App } from './App';
import { initGlobalModalScrollLock } from './hooks/useBodyScrollLock';
import './index.css';

// Automatically lock background scrolling whenever any modal/popup is open
initGlobalModalScrollLock();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
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
  </React.StrictMode>
);
