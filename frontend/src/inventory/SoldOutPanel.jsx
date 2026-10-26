import { useEffect, useState } from 'react';
import Modal from '../components/shared/Modal';
import Switch from '../components/shared/Switch';
import Segmented from '../smarteats/floor/Segmented';
import { useToast } from '../context/useToast';
import { fetchWithAuth } from '../utils/apiClient';
import { row } from '../smarteats/floor/ui';

const soldOut = (product) => product.stock_enabled && product.stock === 0;

// «Esaurito» con un tocco, per la cucina e per chi gestisce: segna un piatto (o un ingrediente) finito e lo rimette in vendita.
// Compare solo nei locali col modulo magazzino; gli ingredienti solo in modalità «magazzino».
const SoldOutPanel = ({ canSeeIngredients, onClose }) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState('dishes');
  const [products, setProducts] = useState(null);
  const [ingredients, setIngredients] = useState(null);

  useEffect(() => {
    fetchWithAuth('/products').then(setProducts).catch(err => showToast(err.message, 'error'));
    if (canSeeIngredients) fetchWithAuth('/ingredients').then(list => setIngredients(list.filter(i => i.active))).catch(err => showToast(err.message, 'error'));
  }, [canSeeIngredients, showToast]);

  const toggle = async (path, available, replace) => {
    try { replace(await fetchWithAuth(path, { method: 'PUT', body: { available } })); }
    catch (err) { showToast(err.message, 'error'); }
  };
  const items = tab === 'dishes' ? products : ingredients;
  const isOut = (x) => (tab === 'dishes' ? soldOut(x) : x.marked_out);

  return (
    <Modal title="Esaurito" size="max-w-lg" onClose={onClose}>
      <div className="space-y-3">
        {canSeeIngredients && <Segmented label="Cosa è finito" value={tab} onChange={setTab} options={[{ id: 'dishes', label: 'Piatti' }, { id: 'ingredients', label: 'Ingredienti' }]} />}
        {!items ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
          <ul className="space-y-1.5">
            {items.map(x => (
              <li key={x.id} className={`${row} flex items-center gap-3`}>
                <span className={`min-w-0 flex-1 truncate ${isOut(x) ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>{x.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{isOut(x) ? 'Esaurito' : 'Disponibile'}</span>
                <Switch label={`${x.name}: disponibile`} checked={!isOut(x)}
                  onChange={available => toggle(tab === 'dishes' ? `/products/${x.id}/availability` : `/ingredients/${x.id}/availability`, available,
                    (saved) => (tab === 'dishes' ? setProducts(list => list.map(p => (p.id === x.id ? saved : p))) : setIngredients(list => list.map(i => (i.id === x.id ? { ...i, marked_out: saved.marked_out } : i)))))} />
              </li>
            ))}
          </ul>)}
      </div>
    </Modal>
  );
};

export default SoldOutPanel;
