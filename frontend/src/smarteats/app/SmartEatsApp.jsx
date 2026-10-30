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
import PrintStatus from '../../components/shell/PrintStatus';
import ServiceControl from '../../components/shell/ServiceControl';
import SideNav from '../../components/shell/SideNav';
import TabBar from '../../components/shell/TabBar';
import PageCard from '../../components/shell/PageCard';
import { termsFor } from '../../utils/terms';
import { ICONS } from './icons';
import NoViewAvailable from '../../components/layout/NoViewAvailable';
import FloorPage from '../floor/FloorPage';
import ReservationsPage from '../reservations/ReservationsPage';
import CatalogPage from '../catalog/CatalogPage';
import TakeawayPage from '../takeaway/TakeawayPage';
import SettingsPage from '../settings/SettingsPage';
import { useInbox } from '../notifications/useInbox';
import ReservedGate from '../../components/shared/ReservedGate';
import StatsTabs from '../../components/shared/StatsTabs';
import Loading from '../../components/shared/Loading';

const KitchenPage = lazy(() => import('../kitchen/KitchenPage'));
const StatsPage = lazy(() => import('../stats/StatsPage'));
const InventoryPage = lazy(() => import('../../inventory/InventoryPage'));
// Senza tavoli (solo asporto) valgono le statistiche della cassa: incasso, prodotti, fasce orarie
const CounterStats = lazy(() => import('../../components/shared/Statistics'));


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
  const hasInventory = ['admin', 'manager'].includes(user.role) && !!user.modules?.includes('inventory') && user.inventory?.mode === 'warehouse';   // ingredienti da riordinare
  const hasInbox = hasBookings || hasTakeaway || hasInventory;
  const inbox = useInbox({ bookings: hasBookings, takeaway: hasTakeaway, inventory: hasInventory, event });
  const count = (...kinds) => inbox.items.filter(i => kinds.includes(i.kind)).length;
  const badges = { reservations: count('request', 'cancel_request'), takeaway: count('takeaway_request'), inventory: count('low_stock') };
  const views = visibleViews(user.role, user.modules, user.inventory);
  usePageTitle(views.find(v => pathname === `/${v.id}`)?.label, user.tenantName, inbox.items.length);
  const home = smartEatsHome(user.role, user.modules, user.inventory);
  if (!home) return <NoViewAvailable onLogout={logout} />;

  const guard = (id, element) => (canViewSmartEats(user.role, id, user.modules, user.inventory) ? element : <Navigate to={`/${home}`} replace />);
  const doLogout = async () => { try { await logout(); showToast('Sessione chiusa', 'info'); navigate('/login'); } catch (err) { console.error(err); } };
  const canManageService = ['admin', 'manager', 'cashier'].includes(user.role);

  return (
    <div className="app-safe flex h-[100dvh] w-full overflow-hidden bg-[var(--bg-main)]">
      <SideNav views={views} icons={ICONS} brand="SmartEats Restaurant" badges={badges} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={user} title={views.find(v => pathname === `/${v.id}`)?.label} serviceControl={<ServiceControl service={service} canManage={canManageService} start={start} closingInfo={closingInfo} end={end} terms={termsFor(user.businessType)} />} status={<PrintStatus />}
          inbox={hasInbox ? inbox : null} onOpenNotification={(i) => {
            if (i.kind === 'low_stock') navigate('/inventory');
            else if (i.kind === 'takeaway_request') navigate('/takeaway', { state: { orderId: i.id, date: i.date } });
            else navigate('/reservations', { state: { reservationId: i.id, date: i.date } });
          }}
          theme={theme} onThemeChange={setTheme} onLogout={doLogout} />

        <div key={pathname} className="motion-page flex-1 min-h-0 flex gap-4 px-4 pt-1 pb-3 md:p-4">
          <Suspense fallback={<PageCard><Loading /></PageCard>}>
            <Routes>
              <Route path="/floor" element={guard('floor', <FloorPage user={user} service={service} event={event} />)} />
              <Route path="/reservations" element={guard('reservations', <ReservationsPage event={event} />)} />
              <Route path="/takeaway" element={guard('takeaway', <TakeawayPage event={event} />)} />
              <Route path="/kitchen" element={guard('kitchen', <PageCard><KitchenPage event={event} /></PageCard>)} />
              <Route path="/catalog" element={guard('catalog', <PageCard><CatalogPage event={event} /></PageCard>)} />
              <Route path="/inventory" element={guard('inventory', <PageCard><InventoryPage /></PageCard>)} />
              <Route path="/stats" element={guard('stats', <PageCard><ReservedGate what="Le statistiche"><StatsTabs>{user.modules?.includes('tables') ? <StatsPage /> : <CounterStats />}</StatsTabs></ReservedGate></PageCard>)} />
              <Route path="/settings" element={guard('settings', <PageCard><SettingsPage user={user} /></PageCard>)} />
              <Route path="*" element={<Navigate to={`/${home}`} replace />} />
            </Routes>
          </Suspense>
        </div>

        <TabBar views={views} icons={ICONS} badges={badges} />
      </main>
    </div>
  );
};

export default SmartEatsApp;
