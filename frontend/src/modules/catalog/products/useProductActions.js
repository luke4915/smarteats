import { fetchWithAuth } from '../../../utils/apiClient';
import { useToast } from '../../../context/useToast';
import { buildPayload, stockProblem, stockUpdateOf } from './productForm';
import { sortByCategoryOrder } from '../../../utils/categoryOrder';
import { upsertProduct } from '../../../utils/productEvents';

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

      // Il server avvisa anche chi ha salvato: `upsertProduct` non raddoppia il prodotto, comunque arrivino le due notizie
      setProducts(prev => upsertProduct(prev, saved));
      showToast(`«${saved.name}» ${editing ? 'modificato' : 'aggiunto'}`, 'success');
      return true;
    } catch (err) { return fail(err, 'Impossibile salvare il prodotto'); }
  };

  // Mostra o nasconde (più prodotti insieme, o uno solo con l'interruttore della riga). Passa sempre da `bulk-visibility`: cambia solo la
  // visibilità, senza rimandare l'intero prodotto (che potrebbe sovrascrivere una modifica fatta nel frattempo da un'altra cassa).
  const sendVisibility = async (ids, visible) => {
    await fetchWithAuth('/products/bulk-visibility', { method: 'PATCH', body: { ids, visible } });
    setProducts(prev => prev.map(p => (ids.includes(p.id) ? { ...p, visible } : p)));
  };

  // L'interruttore della riga: il cambio si vede subito e, se il server rifiuta, torna com'era con il motivo. Niente messaggio di successo:
  // l'interruttore che si muove è già la conferma.
  const toggleVisibility = async (product) => {
    const visible = product.visible === false;       // era nascosto → ora si mostra
    setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, visible } : p)));
    try { await sendVisibility([product.id], visible); return true; }
    catch (err) {
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, visible: !visible } : p)));
      return fail(err, 'Errore nel cambio di visibilità');
    }
  };

  const setManyVisible = async (ids, visible) => {
    if (ids.length === 0) return false;
    try {
      await sendVisibility(ids, visible);
      showToast(`${ids.length === 1 ? '1 prodotto' : `${ids.length} prodotti`} ${visible ? 'visibili' : 'nascosti'}`, 'success');
      return true;
    } catch (err) { return fail(err, "Errore durante l'aggiornamento della visibilità"); }
  };

  // L'ordine delle categorie (barra dei filtri in cassa e in sala, gruppi del Menu): il server lo salva e lo manda a tutti i dispositivi.
  const saveCategoryOrder = async (order) => {
    try {
      await fetchWithAuth('/products/category-order', { method: 'PUT', body: { order } });
      setProducts(prev => sortByCategoryOrder(prev, order));
      showToast('Ordine delle categorie salvato', 'success');
      return true;
    } catch (err) { return fail(err, "Impossibile salvare l'ordine delle categorie"); }
  };

  const remove = async (product) => {
    try {
      await fetchWithAuth(`/products/${product.id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast(`Prodotto "${product.name}" eliminato`, 'success');
      return true;
    } catch (err) { return fail(err, 'Impossibile eliminare il prodotto'); }
  };

  return { save, toggleVisibility, setManyVisible, saveCategoryOrder, remove };
}
