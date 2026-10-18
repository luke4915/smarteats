import { useState, useEffect } from 'react';
import { useToast } from '../context/useToast';
import { useSound } from '../hooks/useSound';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { useWorkSession } from '../hooks/useWorkSession';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { useAuth } from '../context/useAuth';
import { useDevicePairing } from '../offline/useDevicePairing';
import { useInbox } from '../smarteats/notifications/useInbox';

// Tutti i dati vivi della cassa in un posto: preferenze del dispositivo, catalogo, serata, carrello e aggiornamenti
// in tempo reale dal server. La grafica (FestivalApp) li riceve già pronti.
export function useFestivalData(user) {
  const { showToast } = useToast();
  const { refreshSession } = useAuth();

  // Preferenze del dispositivo
  const [theme, setTheme] = useState('dark');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [orderMode, setOrderMode] = useState('simple');
  const playSound = useSound(isSoundEnabled);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);

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
      case 'product_updated': setProducts(prev => prev.map(p => p.id === msg.product.id ? { ...msg.product, price: parseFloat(msg.product.price) } : p)); showToast(`"${msg.product.name}" aggiornato!`, 'success'); break;
      case 'product_created': setProducts(prev => [...prev, { ...msg.product, price: parseFloat(msg.product.price) }]); showToast('Nuovo prodotto aggiunto!', 'success'); break;
      case 'product_deleted': setProducts(prev => prev.filter(p => p.id !== msg.id)); showToast('Prodotto rimosso!', 'warning'); break;
      case 'product_stock_updated':
        setProducts(prev => prev.map(p => (p.id === msg.product.id ? { ...p, stock: msg.product.stock, visible: msg.product.visible } : p)));
        break;
      // L'apertura della serata azzera lo stock lato server: ricarichiamo il catalogo.
      case 'session_started': applySession({ id: msg.session.id, name: msg.session.name }); loadProducts(); break;
      case 'session_ended': applySession(null); break;
      default: break;
    }
  }, { enabled: true, onUnauthorized: refreshSession });

  // Notifiche: gli ordini da asporto da approvare (solo chi li gestisce, solo con il modulo acceso)
  const hasTakeaway = !!user.modules?.includes('takeaway') && ['admin', 'manager', 'cashier'].includes(user.role);
  const inbox = useInbox({ bookings: false, takeaway: hasTakeaway, event });

  return {
    theme, setTheme, isSoundEnabled, setIsSoundEnabled, orderMode, setOrderMode, playSound,
    products, setProducts, activeSession, startSession, endSession, cartState,
    event, connected, inbox: hasTakeaway ? inbox : null,
  };
}
