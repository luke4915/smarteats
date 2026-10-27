// «Vendi comunque»: quando il server rifiuta un ordine perché un ingrediente non basta (409 INGREDIENT_SHORTAGE), amministratore e
// responsabile possono decidere di venderlo lo stesso. `askForce(messaggio)` apre la domanda e risponde true/false; per gli altri
// ruoli risponde subito false (vedranno il rifiuto del server). La finestra si disegna con ForceSaleDialog.
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { canForceSale } from '../inventory/availability';

export const SHORTAGE_CODE = 'INGREDIENT_SHORTAGE';

export function useForceSale() {
  const { user } = useAuth();
  const [pending, setPending] = useState(null);       // il messaggio del server, finché si aspetta la risposta
  const resolver = useRef(null);

  const askForce = useCallback((message) => {
    if (!canForceSale(user?.role)) return Promise.resolve(false);
    return new Promise((resolve) => { resolver.current = resolve; setPending(message); });
  }, [user?.role]);

  const answer = useCallback((yes) => {
    resolver.current?.(yes);
    resolver.current = null;
    setPending(null);
  }, []);

  return { askForce, pending, answer };
}
