import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import toast, { ToastBar, Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { installRuntimeRecovery } from './utils/runtimeRecovery';
import { registerServiceWorker } from './utils/registerServiceWorker';
import './i18n';
import './styles/index.css';

const compactToastStyle = {
  minWidth: '260px',
  maxWidth: 'min(320px, calc(100vw - 2rem))',
  border: '1px solid',
  borderRadius: '12px',
  padding: '9px 10px 11px 16px',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.1), 0 1px 5px rgba(15, 23, 42, 0.06)'
};

installRuntimeRecovery();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AppErrorBoundary>
            <AuthProvider>
              <App />
              <Toaster
                position="top-right"
                gutter={10}
                toastOptions={{
                  duration: 2000,
                  className: 'slivz-toast',
                  style: {
                    ...compactToastStyle,
                    background: '#eff6ff',
                    borderColor: '#bfdbfe',
                    color: '#1e3a5f'
                  },
                  success: {
                    duration: 2000,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#ffffff'
                    },
                    style: {
                      ...compactToastStyle,
                      background: '#f0fdf4',
                      borderColor: '#a7f3d0',
                      color: '#065f46'
                    }
                  },
                  error: {
                    duration: 2000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#ffffff'
                    },
                    style: {
                      ...compactToastStyle,
                      background: '#fff5f5',
                      borderColor: '#fed7d7',
                      color: '#7f1d1d'
                    }
                  }
                }}
              >
                {(t) => (
                  <ToastBar toast={t}>
                    {({ icon, message }) => (
                      <>
                        <span className={`slivz-toast__accent slivz-toast__accent--${t.type}`} />
                        <span className="slivz-toast__icon">{icon}</span>
                        <span className="slivz-toast__message">{message}</span>
                        <button
                          type="button"
                          className="slivz-toast__close"
                          aria-label="Close notification"
                          onClick={() => toast.dismiss(t.id)}
                        >
                          x
                        </button>
                        {t.visible && <span className={`slivz-toast__progress slivz-toast__progress--${t.type}`} />}
                      </>
                    )}
                  </ToastBar>
                )}
              </Toaster>
            </AuthProvider>
          </AppErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
