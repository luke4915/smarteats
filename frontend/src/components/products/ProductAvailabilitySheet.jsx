import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import Segmented from '../../smarteats/floor/Segmented';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import { formatEuro } from '../../utils/format';
import { btnPrimary, iconBtnField, input, label } from '../../smarteats/floor/ui';
import { MODES, modeOf, stateLabel, startQuantity, quantityProblem, stockPatch, savedMessage, isChange } from './availability';

const HINTS = {
  unlimited: 'Nessun limite: si può sempre ordinare.',
  soldout: 'Resta in carta, in grigio, e non si può ordinare.',
  portions: 'Si ordina finché ne restano; quando finiscono diventa «Esaurito».',
};

// La disponibilità di un prodotto, dalla cassa (si apre tenendo premuta la tessera): Disponibile, Quantità o Esaurito, e basta.
// Solo la disponibilità: il prezzo e il resto si cambiano da Menu (e dai permessi dell'amministratore). La regola e i testi stanno
// in `availability.js`; il salvataggio è `PATCH /products/:id/stock`, che il server manda a tutte le casse. `onSaved` riceve scorta e limite.
const ProductAvailabilitySheet = ({ product, onClose, onSaved }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const hasPortionRules = !!user?.inventory;       // col modulo magazzino ogni prodotto ha anche una regola «Porzioni» a inizio servizio
  const [mode, setMode] = useState(() => modeOf(product));
  const [quantity, setQuantity] = useState(() => startQuantity(product));
  const [saving, setSaving] = useState(false);

  const problem = quantityProblem(mode, quantity);
  const step = (delta) => setQuantity(String(Math.max(1, (parseInt(quantity, 10) || 0) + delta)));

  const apply = async () => {
    if (problem || saving) return;
    setSaving(true);
    try {
      const saved = await fetchWithAuth(`/products/${product.id}/stock`, { method: 'PATCH', body: stockPatch(mode, quantity) });
      showToast(savedMessage(product.name, mode, quantity), 'success');
      onSaved({ id: product.id, stock: saved.stock, stock_enabled: saved.stock_enabled });
      onClose();
    } catch (err) {
      showToast(err.message || 'Impossibile cambiare la disponibilità', 'error');
      setSaving(false);
    }
  };

  return (
    <Modal title={product.name} onClose={onClose} onSubmit={(e) => { e.preventDefault(); apply(); }}
      footer={(
        <ModalActions fill onCancel={onClose}>
          <button type="submit" disabled={saving || !!problem || !isChange(product, mode, quantity)} className={btnPrimary}><Check size={16} /> {saving ? 'Salvo…' : 'Applica'}</button>
        </ModalActions>
      )}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)] tabular-nums">{formatEuro(product.price || 0)} · adesso: {stateLabel(product)}</p>
        <Segmented label="Disponibilità" options={MODES} value={mode} onChange={setMode} />
        <p className="text-sm text-[var(--text-muted)]">{HINTS[mode]}</p>
        {hasPortionRules && <p className="text-xs text-[var(--text-muted)]">Vale fino alla prossima apertura del servizio: poi le porzioni ripartono secondo la regola del prodotto (Menu → modifica → Porzioni).</p>}
        {mode === 'portions' && (
          <div>
            <label htmlFor="availability_quantity" className={`${label} block mb-1.5`}>Quantità rimasta</label>
            <div className="flex items-center gap-2">
              <button type="button" className={iconBtnField} aria-label="Una in meno" onClick={() => step(-1)}><Minus size={18} /></button>
              <input id="availability_quantity" type="number" inputMode="numeric" min="1" autoFocus className={`${input} text-center tabular-nums`} value={quantity} onChange={e => setQuantity(e.target.value)} />
              <button type="button" className={iconBtnField} aria-label="Una in più" onClick={() => step(1)}><Plus size={18} /></button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProductAvailabilitySheet;
