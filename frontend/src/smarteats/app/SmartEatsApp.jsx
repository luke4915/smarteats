import { useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/useToast';
import { visibleViews, canViewSmartEats, smartEatsHome } from './views';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { useTheme } from '../../hooks/useTheme';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useService } from './useService';
import AppHeader from '../../components/shell/AppHeader';
import ServiceControl from '../../components/shell/ServiceControl';
import { SideNav, BottomNav } from '../../components/shell/SideNav';
import { termsFor } from '../../utils/terms';
import { ICONS } from './icons';
import NoViewAvailable from '../../components/layout/NoViewAvailable';
import FloorPage from '../floor/FloorPage';
import ReservationsPage from '../reservations/ReservationsPage';
import CatalogPage from '../catalog/CatalogPage';
import TakeawayPage from '../takeaway/TakeawayPage';
import SettingsPage from '../settings/SettingsPage';
import { useInbox } from '../notifications/useInbox';

const KitchenPage = lazy(() => import('../kitchen/KitchenPage'));
const StatsPage = lazy(() => import('../stats/StatsPage'));
// Senza tavoli (solo asporto) valgono le statistiche della cassa: incasso, prodotti, fasce orarie
const CounterStats = lazy(() => import('../../components/shared/Statistics'));

// Pagina a tutta larghezza (la Sala e le prenotazioni gestiscono da sé le loro due colonne)
const Page = ({ children }) => (
  <div className="flex-1 overflow-y-auto no-scrollbar bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 sm:p-6 min-w-0">{children}</div>
);

// App dei ristoranti e delle pizzerie (SmartEats): una shell e una dashboard proprie, separate da quelle della cassa
// delle sagre. Qui sta solo il guscio: testata, navigazione e route; ogni pagina vive nella cartella del suo modulo.
const SmartEatsApp = () => {
  const { user, logout, refreshSession } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { service, start, closingInfo, end, onEvent } = useService();
  const [event, setEvent] = useState(null);
  const [theme, setTheme] = useTheme();

  const handleMessage = useCallback((msg) => { onEvent(msg); setEvent(msg); }, [onEvent]);
  useLiveUpdates(handleMessage, { enabled: !!user, onUnauthorized: refreshSession });

  // Notifiche per il personale di sala: richieste di prenotazione e annulli da decidere
  const staff = ['admin', 'manager', 'cashier', 'waiter'].includes(user.role);
  const hasBookings = staff && !!user.modules?.includes('bookings');
  const hasTakeaway = staff && !!user.modules?.includes('takeaway');
  const hasInbox = hasBookings || hasTakeaway;
  const inbox = useInbox({ bookings: hasBookings, takeaway: hasTakeaway, event });
  const badges = {
    reservations: inbox.items.filter(i => i.kind !== 'takeaway_request').length,
    takeaway: inbox.items.filter(i => i.kind === 'takeaway_request').length,
  };
  const views = visibleViews(user.role, user.modules);
  usePageTitle(views.find(v => pathname === `/${v.id}`)?.label, user.tenantName, inbox.items.length);
  const home = smartEatsHome(user.role, user.modules);
  if (!home) return <NoViewAvailable onLogout={logout} />;

  const guard = (id, element) => (canViewSmartEats(user.role, id, user.modules) ? element : <Navigate to={`/${home}`} replace />);
  const doLogout = async () => { try { await logout(); showToast('Sessione chiusa', 'info'); navigate('/login'); } catch (err) { console.error(err); } };
  const canManageService = ['admin', 'manager', 'cashier'].includes(user.role);

  return (
    <div className="se-app app-safe flex h-[100dvh] w-full overflow-hidden bg-[var(--bg-main)]">
      <SideNav views={views} icons={ICONS} brand="SmartEats Restaurant" badges={badges} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={user} serviceControl={<ServiceControl service={service} canManage={canManageService} start={start} closingInfo={closingInfo} end={end} terms={termsFor(user.businessType)} />}
          inbox={hasInbox ? inbox : null} onOpenNotification={(i) => (i.kind === 'takeaway_request'
            ? navigate('/takeaway', { state: { orderId: i.id, date: i.date } })
            : navigate('/reservations', { state: { reservationId: i.id, date: i.date } }))}
          theme={theme} onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} onLogout={doLogout} />

        <div key={pathname} className="motion-page flex-1 min-h-0 flex gap-4 p-3 sm:p-4">
          <Suspense fallback={<Page><p className="text-[var(--text-muted)]">Caricamento…</p></Page>}>
            <Routes>
              <Route path="/floor" element={guard('floor', <FloorPage user={user} service={service} event={event} />)} />
              <Route path="/reservations" element={guard('reservations', <ReservationsPage event={event} />)} />
              <Route path="/takeaway" element={guard('takeaway', <TakeawayPage event={event} />)} />
              <Route path="/kitchen" element={guard('kitchen', <Page><KitchenPage event={event} /></Page>)} />
              <Route path="/catalog" element={guard('catalog', <Page><CatalogPage /></Page>)} />
              <Route path="/stats" element={guard('stats', <Page>{user.modules?.includes('tables') ? <StatsPage /> : <CounterStats />}</Page>)} />
              <Route path="/settings" element={guard('settings', <Page><SettingsPage user={user} /></Page>)} />
              <Route path="*" element={<Navigate to={`/${home}`} replace />} />
            </Routes>
          </Suspense>
        </div>

        <BottomNav views={views} icons={ICONS} badges={badges} />
      </main>
    </div>
  );
};

export default SmartEatsApp;
