import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { btn } from '../../smarteats/floor/ui';
import { formatEuro } from '../../utils/format';
import { useToast } from '../../context/useToast';
import { listFailedOrders, retryFailedOrder, discardFailedOrder } from '../../offline/failedOrders';
import Loading from './Loading';

// Ordini battuti offline che il server ha rifiutato per sempre (es. sessione chiusa da più di 24 ore):
// restano in cassa finché non si decide cosa farne. Riprova li rimanda; Elimina li toglie per sempre.
const formatTime = (iso) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const FailedOrdersModal = ({ onClose, onChanged }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setOrders(await listFailedOrders()), []);
  useEffect(() => { load(); }, [load]);

  const act = async (action, localId) => {
    setBusy(true);
    try { await action(localId); await load(); onChanged?.(); }
    catch (err) { showToast(`Operazione non riuscita: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Ordini non sincronizzati" size="max-w-lg" onClose={onClose}>
      <p className="text-xs text-[var(--text-muted)] mb-4">Il server li ha rifiutati. Verifica in cassa se vanno registrati a mano, poi toglili dall'elenco.</p>
      <div className="space-y-3">
        {!orders && <Loading />}
        {orders?.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nessun ordine da controllare.</p>}
        {orders?.map(o => (
          <div key={o.localId} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium text-sm text-[var(--text-main)]">{o.displayCode ? `Ordine ${o.displayCode}` : 'Ordine offline'}</p>
              <p className="text-xs text-[var(--text-muted)] tabular-nums">{formatTime(o.createdAt)}{o.total != null && ` · ${formatEuro(o.total)}`}</p>
            </div>
            <ul className="mt-1.5 text-xs text-[var(--text-main)]">
              {o.items.map((i, n) => (
                <li key={n}>{i.quantity} × {i.name}{i.note && <span className="text-[var(--text-muted)]"> ({i.note})</span>}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium text-red-500">{o.error}</p>
            <div className="flex gap-2 mt-3">
              <button disabled={busy} onClick={() => act(retryFailedOrder, o.localId)} className={`${btn} !h-9`}><RotateCcw size={14} /> Riprova</button>
              <button disabled={busy} onClick={() => act(discardFailedOrder, o.localId)} className={`${btn} !h-9`}><Trash2 size={14} /> Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default FailedOrdersModal;
