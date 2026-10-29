import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { applyProductEvent } from '../../utils/productEvents';

// La carta (prodotti visibili), caricata quando serve; `enabled` false = non scaricare. Segue gli avvisi in tempo reale (`event`, l'ultimo
// messaggio del server): un piatto esaurito dalla cucina o cambiato in Carta si aggiorna sulla tessera senza ricaricare.
export function useProducts(enabled, event = null) {
  const { showToast } = useToast();
  const [products, setProducts] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    fetchWithAuth('/products')
      .then(list => setProducts(list.filter(p => p.visible !== false).map(p => ({ ...p, price: parseFloat(p.price) }))))
      .catch(err => showToast(err.message || 'Errore caricamento carta', 'error'));
  }, [enabled, showToast]);
  useEffect(() => {
    if (event) setProducts(prev => (prev ? applyProductEvent(prev, event) : prev));
  }, [event]);
  return products;
}
