import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { buildPayload, stockProblem, stockUpdateOf } from './productForm';

// Le azioni sui prodotti che parlano col server (salva, mostra/nascondi, elimina). Ognuna aggiorna l'elenco `products`
// in memoria e avvisa con un messaggio; ritorna `true` se è andata a buon fine.
export function useProductActions({ setProducts, hasModifierGroups, onModifiersSaved }) {
  const { showToast } = useToast();
  const fail = (err, fallback) => { console.error(fallback, err); showToast(err.message || fallback, 'error'); return false; };

  // Crea o modifica. Dopo il prodotto si salvano la disponibilità (stock) e le opzioni: se una di queste fallisce, il prodotto resta salvato.
  const save = async (form, editing) => {
    const problem = stockProblem(form);
    if (problem) { showToast(problem, 'error'); return false; }
    try {
      const saved = await fetchWithAuth(editing ? `/products/${editing.id}` : '/products', { method: editing ? 'PUT' : 'POST', body: buildPayload(form) });

      const stockUpdate = stockUpdateOf(form);
      if (stockUpdate) {
        try {
          const stock = await fetchWithAuth(`/products/${saved.id}/stock`, { method: 'PATCH', body: stockUpdate });
          Object.assign(saved, { stock: stock.stock, stock_enabled: stock.stock_enabled });
        } catch (err) { showToast(`Prodotto salvato, ma errore nell'aggiornamento dello stock: ${err.message}`, 'error'); }
      }
      if (hasModifierGroups) {
        try {
          await fetchWithAuth(`/products/${saved.id}/modifier-groups`, { method: 'PUT', body: { group_ids: form.modifier_group_ids ?? [] } });
          onModifiersSaved?.();
        } catch (err) { showToast(`Prodotto salvato, ma errore nelle opzioni: ${err.message}`, 'error'); }
      }

      const product = { ...saved, price: parseFloat(saved.price) };
      setProducts(prev => (editing ? prev.map(p => (p.id === product.id ? product : p)) : [...prev, product]));
      showToast(`Prodotto "${product.name}" ${editing ? 'modificato' : 'aggiunto'} con successo`, 'success');
      return true;
    } catch (err) { return fail(err, 'Impossibile salvare il prodotto'); }
  };

  const toggleVisibility = async (product) => {
    const visible = !product.visible;
    try {
      await fetchWithAuth(`/products/${product.id}`, { method: 'PUT', body: { ...product, visible } });
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, visible } : p)));
      showToast(`Visibilità "${product.name}" aggiornata`, 'success');
      return true;
    } catch (err) { return fail(err, 'Errore nel cambio visibilità'); }
  };

  const setManyVisible = async (ids, visible) => {
    if (ids.length === 0) return false;
    try {
      await fetchWithAuth('/products/bulk-visibility', { method: 'PATCH', body: { ids, visible } });
      setProducts(prev => prev.map(p => (ids.includes(p.id) ? { ...p, visible } : p)));
      showToast(`Visibilità aggiornata per ${ids.length} prodotti`, 'success');
      return true;
    } catch (err) { return fail(err, "Errore durante l'aggiornamento della visibilità"); }
  };

  const remove = async (product) => {
    try {
      await fetchWithAuth(`/products/${product.id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast(`Prodotto "${product.name}" eliminato`, 'success');
      return true;
    } catch (err) { return fail(err, 'Impossibile eliminare il prodotto'); }
  };

  return { save, toggleVisibility, setManyVisible, remove };
}
