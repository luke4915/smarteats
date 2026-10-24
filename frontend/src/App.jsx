import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './context/useAuth';
import ChangePassword from './components/shared/ChangePassword';
import Login from './pages/LoginPage';
import FestivalApp from './festival/FestivalApp';

// Pagine pubbliche e del master: si caricano a richiesta (grafici, pagine dei clienti), il service worker le tiene in cache.
const KDS = lazy(() => import('./pages/KDSPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const MasterPage = lazy(() => import('./pages/MasterPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const ShortLink = lazy(() => import('./pages/ShortLink'));

const PageLoading = () => (
  <div className="h-full min-h-[50vh] flex items-center justify-center text-[var(--text-main)]">Caricamento...</div>
);

// Il punto d'ingresso per tutto ciò che non è SmartEats: pagine pubbliche (prenotazione, ordine, menu, KDS, master),
// accesso, cambio della password temporanea; poi la cassa delle sagre (festival/FestivalApp.jsx).
const App = () => {
  const { user, loading, login } = useAuth();
  const path = window.location.pathname;

  // Pagine dei clienti: pubbliche anche per chi ha una sessione aperta in questo browser
  if (/^\/book(\/|$)/.test(path)) return <Suspense fallback={<PageLoading />}><BookingPage /></Suspense>;
  if (/^\/order(\/|$)/.test(path)) return <Suspense fallback={<PageLoading />}><OrderPage /></Suspense>;
  if (path === '/privacy' || path === '/terms') return <Suspense fallback={<PageLoading />}><LegalPage kind={path.slice(1)} /></Suspense>;
  if (/^\/s\//.test(path)) return <Suspense fallback={<PageLoading />}><ShortLink /></Suspense>;

  if (loading) return <div className="h-dvh flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">Caricamento...</div>;

  if (path === '/kds') return <Suspense fallback={<PageLoading />}><KDS /></Suspense>;

  if (!user) return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/master" element={<MasterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );

  // Password temporanea: il server blocca tutto il resto finché non la si cambia
  if (user.needsPassword) return <ChangePassword onPasswordChanged={() => login({ ...user, needsPassword: false })} />;
  if (path === '/menu') return <Suspense fallback={<PageLoading />}><MenuPage /></Suspense>;
  if (path === '/master') return <Suspense fallback={<PageLoading />}><MasterPage /></Suspense>;

  return <FestivalApp />;
};

export default App;
