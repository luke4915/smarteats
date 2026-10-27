import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './AppRouter';
import './index.css';
import ErrorBoundary from './components/layout/ErrorBoundary';
import { AuthProvider } from './context/AuthProvider';
import { ToastProvider } from './context/ToastProvider';
import { ReservedDataProvider } from './context/ReservedDataProvider';
import UpdateBanner from './components/shell/UpdateBanner';
import WhatsNew from './components/shell/WhatsNew';

const root = createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <ReservedDataProvider>
                        <ErrorBoundary>
                            <AppRouter />
                            <WhatsNew />
                            <UpdateBanner />
                        </ErrorBoundary>
                    </ReservedDataProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);