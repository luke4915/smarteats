import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';

// Il dettaglio di un conto, riletto quando un altro dispositivo lo modifica (eventi in tempo reale).
// `onGone` si chiama se il conto non si può più leggere.
//
// Importante: `onGone` cambia a ogni ridisegno del genitore, quindi si tiene in un ref. Se entrasse tra le dipendenze,
// ogni modifica della comanda (anche una lettera in una nota) rileggerebbe il conto da zero svuotando il pannello:
// si perderebbero lo stato dei campi e la schermata dell'incasso.
export function useCheckDetail(checkId, event, onGone) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const gone = useRef(onGone);
  useEffect(() => { gone.current = onGone; });

  const reload = useCallback(async () => {
    try { setDetail(await fetchWithAuth(`/checks/${checkId}`)); }
    catch (err) { showToast(err.message, 'error'); gone.current?.(); }
  }, [checkId, showToast]);

  // Solo quando cambia il conto si riparte da vuoto; le riletture successive aggiornano senza svuotare.
  useEffect(() => { setDetail(null); }, [checkId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const touched = (event?.type === 'check_updated' && event.check.id === checkId) || (event?.type === 'order_updated' && event.order.check_id === checkId);
    if (touched) reload();
  }, [event, checkId, reload]);

  return { detail, reload };
}
