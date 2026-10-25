import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { useIsMobile } from '../hooks/useBreakpoint';
import { usePageTitle } from '../hooks/usePageTitle';
import { sendOrder } from '../utils/sendOrder';
import { fetchWithAuth } from '../utils/apiClient';
import { termsFor } from '../utils/terms';
import { defaultView } from '../components/layout/viewRoles';
import NoViewAvailable from '../components/layout/NoViewAvailable';
import LogoutConfirmModal from '../components/layout/LogoutConfirmModal';
import AppHeader from '../components/shell/AppHeader';
import ServiceControl from '../components/shell/ServiceControl';
import { SideNav, BottomNav } from '../components/shell/SideNav';
import Cart from '../components/cart/Cart';
import MobileCartOverlay from '../components/cart/mobile/MobileCartOverlay';
import ReverseOrder from '../components/shared/ReverseOrder';
import { useFestivalData } from './useFestivalData';
import { festivalViews } from './views';
import { ICONS } from './icons';
import SyncStatus from './SyncStatus';
import FestivalRoutes from './FestivalRoutes';

// Ruoli abilitati ad applicare sconti/omaggi (specchio di DISCOUNT_ROLES nel backend)
const DISCOUNT_ROLES = ['admin', 'manager'];

// L'app della cassa delle sagre dopo il login, con lo stesso guscio di SmartEats (menu, testata, servizio in un solo punto):
// qui si collegano dati (useFestivalData), pagine (FestivalRoutes) e carrello. La logica sta negli hook e nei componenti.
const FestivalApp = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const data = useFestivalData(user);
  const { cartState, activeSession, products, setProducts } = data;

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showReversePopup, setShowReversePopup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const views = festivalViews(user.role, user.modules, user.inventory);
  usePageTitle(views.find(v => pathname === `/${v.id}`)?.label, user.tenantName, data.inbox?.items.length ?? 0);
  const lowStock = data.inbox?.items.filter(i => i.kind === 'low_stock').length ?? 0;
  const badges = { takeaway: (data.inbox?.items.length ?? 0) - lowStock, inventory: lowStock };
  const home = defaultView(user.role, user.modules, user.inventory);
  if (!home) return <NoViewAvailable onLogout={logout} />;

  const onCashPage = pathname === '/dashboard';
  const handleSendOrder = (isTakeaway = false) => sendOrder({
    cart: cartState.cart, isTakeaway, activeSession, orderMode: data.orderMode, clearCart: cartState.clearCart,
    playSound: data.playSound, showToast, onSent: () => { if (isMobile) setIsMobileCartOpen(false); },
  });
  const performLogout = async () => {
    try { await logout(); setShowLogoutConfirm(false); showToast('Sessione chiusa', 'info'); navigate('/login'); }
    catch (err) { console.error(err); }
  };
  const cartProps = { ...cartState, products, sendOrder: handleSendOrder, sessionActive: !!activeSession, setShowReversePopup, canDiscount: DISCOUNT_ROLES.includes(user.role) };
  const canManageService = ['admin', 'manager', 'cashier'].includes(user.role);
  const serviceControl = (
    <ServiceControl service={activeSession} canManage={canManageService} terms={termsFor(user.businessType)}
      start={data.startSession} end={data.endSession} closingInfo={() => fetchWithAuth('/sessions/expected-cash')} />
  );

  return (
    <div className="se-app app-safe flex h-[100dvh] w-full overflow-hidden bg-[var(--bg-main)]">
      <SideNav views={views} icons={ICONS} brand="SmartEats Stand" badges={badges} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={user} serviceControl={serviceControl} status={<SyncStatus connected={data.connected} />}
          inbox={data.inbox} onOpenNotification={(i) => (i.kind === 'low_stock' ? navigate('/inventory') : navigate('/takeaway', { state: { orderId: i.id, date: i.date } }))}
          theme={data.theme} onToggleTheme={() => data.setTheme(t => (t === 'dark' ? 'light' : 'dark'))} onLogout={() => setShowLogoutConfirm(true)} />

        <div className="flex-1 min-h-0 flex gap-4 p-3 sm:p-4">
          <div key={pathname} className="motion-page flex-1 overflow-y-auto no-scrollbar bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 sm:p-6 min-w-0">
            <FestivalRoutes user={user} home={home} products={products} setProducts={setProducts} cart={cartState.cart} cartState={cartState} event={data.event}
              setup={{ theme: data.theme, setTheme: data.setTheme, isSoundEnabled: data.isSoundEnabled, setIsSoundEnabled: data.setIsSoundEnabled, orderMode: data.orderMode, setOrderMode: data.setOrderMode }} />
          </div>
          {onCashPage && (
            <div className="w-[340px] xl:w-[420px] hidden md:flex flex-col shrink-0"><Cart {...cartProps} /></div>
          )}
        </div>

        <BottomNav views={views} icons={ICONS} badges={badges} />
      </main>

      {isMobile && onCashPage && (
        <MobileCartOverlay aboveNav={views.length > 1} isOpen={isMobileCartOpen} onOpen={() => setIsMobileCartOpen(true)} onClose={() => setIsMobileCartOpen(false)}
          onReverseClick={() => { setShowReversePopup(true); setIsMobileCartOpen(false); }} cartProps={cartProps} />
      )}
      {showLogoutConfirm && <LogoutConfirmModal onConfirm={performLogout} onCancel={() => setShowLogoutConfirm(false)} />}
      {showReversePopup && <ReverseOrder onClose={() => setShowReversePopup(false)} />}
    </div>
  );
};

export default FestivalApp;
