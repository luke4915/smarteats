import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import SortableList from '../shared/SortableList';
import { btnPrimary } from '../../smarteats/floor/ui';

// Il menu per riordinare le categorie: si trascinano (o si spostano con le frecce dalla maniglia) e l'ordine vale per le tessere dei filtri in
// cassa e in sala, per i gruppi del Menu e per il menu QR. `categories` è l'ordine di adesso; `counts` quanti prodotti ha ognuna;
// `onSave(order)` salva e ritorna true se è andata bene (allora la finestra si chiude).
const CategoryOrderModal = ({ categories, counts, onSave, onClose }) => {
  const [order, setOrder] = useState(categories);
  const [busy, setBusy] = useState(false);
  const changed = order.some((c, i) => c !== categories[i]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSave(order);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Ordine delle categorie" onClose={onClose} onSubmit={save}
      footer={<ModalActions fill onCancel={onClose}><button type="submit" className={btnPrimary} disabled={busy || !changed}>{busy ? 'Salvo…' : 'Salva'}</button></ModalActions>}>
      <p className="text-sm text-[var(--text-muted)] mb-3">Trascina per cambiare l&apos;ordine con cui compaiono i filtri in cassa, in sala e nel Menu.</p>
      <SortableList items={order} getId={c => c} onReorder={setOrder} className="list-none"
        renderItem={(c, { handleProps, isDragging }) => (
          <div className={`flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-lg border bg-[var(--bg-card-2)] ${isDragging ? 'border-[var(--accent)] shadow-lg' : 'border-[var(--border)]'}`}>
            <span {...handleProps} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"><GripVertical size={18} /></span>
            <span className="flex-1 min-w-0 truncate text-base text-[var(--text-main)]">{c}</span>
            <span className="text-sm tabular-nums text-[var(--text-muted)]">{counts[c] ?? 0}</span>
          </div>
        )} />
    </Modal>
  );
};

export default CategoryOrderModal;
