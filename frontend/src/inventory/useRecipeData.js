// I dati per scrivere le ricette dalla Carta: ingredienti, preparazioni e il riepilogo delle ricette dei piatti (quanti ingredienti
// ha ognuna). Servono solo ai locali che scalano gli ingredienti dalle ricette (`recipesEnabled`); gli altri non chiedono nulla.
// `reload` li rilegge dopo un salvataggio.
import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';

export const recipesEnabled = (user) => user?.inventory?.mode === 'warehouse' && user.inventory.depletion === 'recipes';

export function useRecipeData(enabled) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const [ingredients, preparations, recipes] = await Promise.all([fetchWithAuth('/ingredients'), fetchWithAuth('/preparations'), fetchWithAuth('/products/recipes-summary')]);
      setData({ ingredients, preparations, summaryOf: new Map(recipes.map(r => [r.product_id, r])) });
    } catch (err) { showToast(err.message || 'Errore caricamento ricette', 'error'); }
  }, [enabled, showToast]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}
