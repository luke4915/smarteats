import { useState, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { fetchWithAuth } from '../../utils/apiClient';
import { categoriesInOrder, categoryOf } from '../../utils/categoryOrder';
import CategoryOrderModal from '../../modules/catalog/products/CategoryOrderModal';
import { btn } from '../shared/styles';

// L'ordine delle categorie del menu pubblico (e, con lui, di cassa e Menu: è un solo ordine per tutto il locale). Stessa finestra del Menu.
const MenuCategoryOrder = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState(null);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => { fetchWithAuth('/products').then(setProducts).catch(() => setProducts([])); }, []);
  if (!products) return null;
  const categories = categoriesInOrder(products);

  const save = async (order) => {
    try {
      await fetchWithAuth('/products/category-order', { method: 'PUT', body: { order } });
      setProducts(prev => [...prev].sort((a, b) => order.indexOf(categoryOf(a)) - order.indexOf(categoryOf(b))));
      showToast('Ordine delle categorie salvato', 'success');
      return true;
    } catch (err) { showToast(err.message, 'error'); return false; }
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Ordine delle categorie</h2>
        <p className="text-sm text-[var(--text-muted)]">È l'ordine con cui i clienti vedono le categorie nel menu (è lo stesso della cassa e del Menu).</p>
      </div>
      {categories.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Non ci sono ancora prodotti.</p> : (
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c, i) => <span key={c} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--border)] text-sm text-[var(--text-main)]"><span className="text-xs tabular-nums text-[var(--text-muted)]">{i + 1}</span>{c}</span>)}
          {categories.length > 1 && <button type="button" className={`${btn} !h-8 !px-3`} onClick={() => setOrdering(true)}><ArrowUpDown size={14} /> Riordina</button>}
        </div>
      )}
      {ordering && <CategoryOrderModal categories={categories} counts={Object.fromEntries(categories.map(c => [c, products.filter(p => categoryOf(p) === c).length]))} onSave={save} onClose={() => setOrdering(false)} />}
    </div>
  );
};

export default MenuCategoryOrder;
