// I dati del magazzino per la pagina «Magazzino»: ingredienti (con i giorni di scorta), fornitori e scorte da riordinare.
// `reload` li rilegge tutti dopo un salvataggio. Le ricette stanno nella Carta (`useRecipeData.js`).
import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';

export function useInventoryData() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    try {
      const [ingredients, suppliers, restock] = await Promise.all([fetchWithAuth('/ingredients'), fetchWithAuth('/suppliers'), fetchWithAuth('/inventory/restock')]);
      setData({ ingredients, suppliers, restock });
    } catch (err) { showToast(err.message || 'Errore caricamento magazzino', 'error'); }
  }, [showToast]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}
