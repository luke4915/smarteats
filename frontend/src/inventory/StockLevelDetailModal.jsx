import { useEffect, useState } from 'react';
import Modal from '../components/shared/Modal';
import { btn, row } from '../smarteats/floor/ui';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { formatQuantity, formatCents } from './units';
import { differenceText } from './controls';

// Un controllo già registrato: per ogni ingrediente cosa prevedeva il registro, cosa è stato contato e quanto vale la differenza.
const StockLevelDetailModal = ({ levelId, onClose }) => {
  const { showToast } = useToast();
  const [level, setLevel] = useState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchWithAuth(`/stock-levels/${levelId}`).then(setLevel).catch(err => { showToast(err.message, 'error'); onClose(); }); }, [levelId]);
  const total = level?.lines.reduce((sum, l) => sum + l.difference_value_cents, 0) ?? 0;

  return (
    <Modal title={level ? `Controllo del ${new Date(level.created_at).toLocaleDateString('it-IT')}` : 'Controllo'} size="max-w-3xl" onClose={onClose}
      footer={<div className="flex items-center gap-3"><p className="text-sm text-[var(--text-muted)] tabular-nums mr-auto">{level && `Valore delle differenze ${formatCents(total)}`}</p><button type="button" className={btn} onClick={onClose}>Chiudi</button></div>}>
      {!level ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <div className="space-y-3">
          {level.notes && <p className="text-sm text-[var(--text-muted)]">{level.notes}</p>}
          <ul className="space-y-1.5">
            {level.lines.map(l => (
              <li key={l.ingredient_id} className={`${row} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                <span className="font-medium text-[var(--text-main)] flex-1 min-w-40">{l.name}</span>
                <span className="text-sm text-[var(--text-muted)] tabular-nums">previsti {formatQuantity(l.expected_quantity, l.base_unit)} · contati {formatQuantity(l.counted_quantity, l.base_unit)}</span>
                <span className={`text-sm tabular-nums w-40 text-right ${l.difference < 0 ? 'text-red-500' : l.difference > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
                  {differenceText(l.difference, l.base_unit)}{l.difference !== 0 && ` (${formatCents(l.difference_value_cents)})`}</span>
              </li>))}
          </ul>
        </div>)}
    </Modal>
  );
};

export default StockLevelDetailModal;
