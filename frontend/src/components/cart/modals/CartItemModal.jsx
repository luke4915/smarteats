import { useState } from 'react';
import { Trash2, Plus, Minus, Check } from 'lucide-react';
import { getLineTotal } from '../../../utils/pricing';
import Modal from '../../shared/Modal';
import Segmented from '../../../smarteats/floor/Segmented';
import { btnPrimary, btnDanger, btn, input, label } from '../../../smarteats/floor/ui';

const TYPES = [{ id: 'sale', label: 'Normale' }, { id: 'discount', label: 'Sconto' }, { id: 'gift', label: 'Omaggio' }];
const MODES = [{ id: 'percent', label: '%' }, { id: 'amount', label: '€' }];

// Una riga del carrello: quantità, sconto o omaggio (solo chi può), nota per la cucina. Si chiude con Esc o toccando
// fuori e salva la nota; «Rimuovi» toglie la riga.
const CartItemModal = ({ item, onClose, onAdd, onRemove, onDelete, onNoteChange, onTypeChange, canDiscount }) => {
  const [note, setNote] = useState(item.note || '');
  const close = () => { if (note !== (item.note || '')) onNoteChange(item, note); onClose(); };

  // Con lo stock attivo non si supera la scorta
  const maxStock = item.stock_enabled && item.stock !== null && item.quantity >= item.stock;
  const discountMode = item.discountMode || 'percent';
  const discountValue = item.discountValue ?? 0;
  const total = getLineTotal(item);
  const adjusted = item.type !== 'sale';

  return (
    <Modal title={item.name} onClose={close}
      footer={(
        <div className="flex gap-3">
          <button onClick={() => { onDelete(item); onClose(); }} className={`${btnDanger} flex-1`}><Trash2 size={16} /> Rimuovi</button>
          <button onClick={close} className={`${btnPrimary} flex-1`}><Check size={16} /> Conferma</button>
        </div>
      )}>
      <div className="space-y-5">
        <p className="flex items-baseline gap-2 tabular-nums -mt-1">
          {adjusted && <span className="text-sm text-[var(--text-muted)] line-through">{(item.price * item.quantity).toFixed(2)} €</span>}
          <span className={`text-lg font-semibold ${item.type === 'gift' ? 'text-purple-500' : item.type === 'discount' ? 'text-orange-500' : 'text-[var(--text-main)]'}`}>{total.toFixed(2)} €</span>
        </p>

        <div>
          <p className={`${label} mb-2`}>Quantità</p>
          <div className="flex items-center gap-3">
            <button onClick={() => onRemove(item)} aria-label="Una in meno" className={`${btn} flex-1`}><Minus size={18} /></button>
            <span className="text-3xl font-semibold tabular-nums text-[var(--text-main)] w-12 text-center">{item.quantity}</span>
            <button onClick={() => onAdd(item)} disabled={maxStock} aria-label="Una in più" className={`${btn} flex-1`}><Plus size={18} /></button>
          </div>
          {maxStock && <p className="text-xs font-medium text-orange-500 text-center mt-2">Scorte terminate per questo articolo</p>}
        </div>

        {canDiscount && (
          <div>
            <p className={`${label} mb-2`}>Sconto su questo prodotto</p>
            <Segmented label="Tipo di prezzo" value={item.type} options={TYPES}
              onChange={(type) => (type === 'discount' ? onTypeChange(item, 'discount', discountMode, discountValue || 10) : onTypeChange(item, type))} />
            {item.type === 'discount' && (
              <div className="flex items-center gap-2 mt-3">
                <Segmented label="Sconto in" value={discountMode} options={MODES} className="shrink-0 w-28" onChange={(mode) => onTypeChange(item, 'discount', mode, discountValue)} />
                <input type="number" min={0} max={discountMode === 'percent' ? 100 : item.price} step={discountMode === 'percent' ? 1 : 0.1} value={discountValue} aria-label="Valore dello sconto"
                  onChange={e => onTypeChange(item, 'discount', discountMode, e.target.value === '' ? 0 : Number(e.target.value))} className={`${input} flex-1 min-w-0`} />
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="cart-note" className={`${label} block mb-2`}>Note cucina</label>
          <textarea id="cart-note" rows={2} placeholder="Es: senza cipolla, ben cotto..." value={note} onChange={e => setNote(e.target.value.toUpperCase())}
            className={`${input} !h-auto py-2.5 resize-none`} />
        </div>
      </div>
    </Modal>
  );
};

export default CartItemModal;
