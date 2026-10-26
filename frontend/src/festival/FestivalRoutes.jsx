import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { canView } from '../components/layout/viewRoles';
import ProductList from '../components/products/ProductList';
import ProductConfig from '../components/products/ProductConfig';
import TakeawayPage from '../smarteats/takeaway/TakeawayPage';
import SetupPage from './SetupPage';
import KitchenScanner from './KitchenScanner';
import ReservedGate from '../components/shared/ReservedGate';
import StatsTabs from '../components/shared/StatsTabs';

// Schermate pesanti: si caricano a richiesta, così il bundle della cassa resta leggero (il service worker le tiene
// comunque in cache, quindi funzionano anche offline).
const KitchenPage = lazy(() => import('../smarteats/kitchen/KitchenPage'));
const Statistics = lazy(() => import('../components/shared/Statistics'));
const InventoryPage = lazy(() => import('../inventory/InventoryPage'));

// Le pagine della cassa. Una pagina che il ruolo non può vedere riporta alla prima disponibile (`home`).
const FestivalRoutes = ({ user, home, products, setProducts, cart, cartState, event, setup }) => {
  const guard = (id, element) => (canView(user.role, id, user.modules, user.inventory) ? element : <Navigate to={`/${home}`} replace />);
  return (
    <Suspense fallback={<p className="text-[var(--text-muted)]">Caricamento…</p>}>
      <Routes>
        <Route path="/dashboard" element={guard('dashboard', <ProductList setProducts={setProducts} products={products} addToCart={cartState.addToCart} removeLastItem={cartState.removeLastItem} cart={cart} />)} />
        <Route path="/takeaway" element={guard('takeaway', <div className="flex gap-4 h-[calc(100dvh-10rem)] min-h-[420px]"><TakeawayPage event={event} /></div>)} />
        <Route path="/kitchen" element={guard('kitchen', <KitchenPage event={event} actions={<KitchenScanner />} />)} />
        <Route path="/statistics" element={guard('statistics', <ReservedGate what="Le statistiche"><StatsTabs><Statistics /></StatsTabs></ReservedGate>)} />
        <Route path="/config" element={guard('config', <ProductConfig products={products} setProducts={setProducts} />)} />
        <Route path="/inventory" element={guard('inventory', <InventoryPage />)} />
        <Route path="/setup" element={guard('setup', <SetupPage user={user} {...setup} />)} />
        <Route path="*" element={<Navigate to={`/${home}`} replace />} />
      </Routes>
    </Suspense>
  );
};

export default FestivalRoutes;
