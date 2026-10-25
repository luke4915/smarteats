// I dati del magazzino per la pagina «Magazzino»: ingredienti, preparazioni, fornitori, piatti e il riepilogo delle ricette.
// `reload` li rilegge tutti dopo un salvataggio.
import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';

export function useInventoryData() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    try {
      const [ingredients, preparations, products, recipes, suppliers] = await Promise.all([
        fetchWithAuth('/ingredients'), fetchWithAuth('/preparations'), fetchWithAuth('/products'), fetchWithAuth('/products/recipes-summary'), fetchWithAuth('/suppliers')]);
      setData({ ingredients, preparations, products, recipes, suppliers });
    } catch (err) { showToast(err.message || 'Errore caricamento magazzino', 'error'); }
  }, [showToast]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}
