import { useState } from 'react';
import { useToast } from '../context/useToast';
import { useSound } from '../hooks/useSound';
import { useTheme } from '../hooks/useTheme';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { useWorkSession } from '../hooks/useWorkSession';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { applyProductEvent } from '../utils/productEvents';
import { useAuth } from '../context/useAuth';
import { useDevicePairing } from '../offline/useDevicePairing';
import { useInbox } from '../smarteats/notifications/useInbox';

// Tutti i dati vivi della cassa in un posto: preferenze del dispositivo, catalogo, serata, carrello e aggiornamenti
// in tempo reale dal server. La grafica (FestivalApp) li riceve già pronti.
export function useFestivalData(user) {
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

  // Preferenze del dispositivo
  const [theme, setTheme] = useTheme();
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
      case 'product_updated': setProducts(prev => applyProductEvent(prev, msg)); if (msg.by !== user?.id) showToast(`"${msg.product.name}" aggiornato!`, 'success'); break;
      case 'product_created': setProducts(prev => applyProductEvent(prev, msg)); if (msg.by !== user?.id) showToast('Nuovo prodotto aggiunto!', 'success'); break;
      case 'product_deleted': setProducts(prev => applyProductEvent(prev, msg)); if (msg.by !== user?.id) showToast('Prodotto rimosso!', 'warning'); break;
      case 'product_stock_updated': setProducts(prev => applyProductEvent(prev, msg)); break;
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
    theme, setTheme, isSoundEnabled, setIsSoundEnabled, orderMode, setOrderMode, playSound,
    products, setProducts, activeSession, startSession, endSession, cartState,
    event, connected, inbox: hasTakeaway || hasInventory ? inbox : null,
  };
}
