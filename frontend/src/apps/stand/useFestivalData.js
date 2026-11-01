import { useState } from 'react';
import { useToast } from '../../context/useToast';
import { useSound } from '../../hooks/useSound';
import { useTheme } from '../../hooks/useTheme';
import { useCart } from '../../hooks/useCart';
import { useProducts } from '../../hooks/useProducts';
import { useWorkSession } from '../../hooks/useWorkSession';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { applyProductEvent, productNotice } from '../../utils/productEvents';
import { useAuth } from '../../context/useAuth';
import { useDevicePairing } from '../../offline/useDevicePairing';
import { useInbox } from '../../modules/notifications/useInbox';

// Tutti i dati vivi della cassa in un posto: preferenze del dispositivo, catalogo, serata, carrello e aggiornamenti
// in tempo reale dal server. La grafica (FestivalApp) li riceve già pronti.
export function useFestivalData(user) {
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

  // Preferenze del dispositivo
  const [theme, setTheme, resolvedTheme] = useTheme();
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [orderMode, setOrderMode] = useState('simple');
  const playSound = useSound(isSoundEnabled);

  // Catalogo, serata, carrello
  useDevicePairing();
  const { products, setProducts, loadProducts } = useProducts(true);
  const { activeSession, applySession, startSession, endSession } = useWorkSession(true);
  const cartState = useCart({ showToast, playSound });

  // Aggiornamenti in tempo reale
  const [event, setEvent] = useState(null);
  const connected = useLiveUpdates((msg) => {
    setEvent(msg);
    switch (msg.type) {
      // chi ha fatto la modifica ha già il suo messaggio: gli altri dispositivi aggiornano l'elenco e lo dicono
      case 'product_created': case 'product_updated': case 'product_deleted': case 'category_order_updated': case 'product_stock_updated': {
        const notice = msg.by !== user?.id ? productNotice(msg, products) : null;
        if (notice) showToast(notice.text, notice.tone);
        setProducts(prev => applyProductEvent(prev, msg));
        break;
      }
      // L'apertura della serata azzera lo stock lato server: ricarichiamo il catalogo.
      case 'session_started': applySession({ id: msg.session.id, name: msg.session.name }); loadProducts(); break;
      case 'session_ended': applySession(null); break;
      default: break;
    }
  }, { enabled: true, onUnauthorized: refreshSession });

  // Notifiche: gli ordini da asporto da approvare (solo chi li gestisce, solo con il modulo acceso) e gli ingredienti da riordinare
  const hasTakeaway = !!user.modules?.includes('takeaway') && ['admin', 'manager', 'cashier'].includes(user.role);
  const hasInventory = ['admin', 'manager'].includes(user.role) && !!user.modules?.includes('inventory') && user.inventory?.mode === 'warehouse';
  const inbox = useInbox({ bookings: false, takeaway: hasTakeaway, inventory: hasInventory, event });

  return {
    theme, setTheme, resolvedTheme, isSoundEnabled, setIsSoundEnabled, orderMode, setOrderMode, playSound,
    products, setProducts, activeSession, startSession, endSession, cartState,
    event, connected, inbox: hasTakeaway || hasInventory ? inbox : null,
  };
}
