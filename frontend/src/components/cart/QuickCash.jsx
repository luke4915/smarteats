import { X } from 'lucide-react';
import { QUICK_CASH, addCash, exactCash } from './cash';

// I tasti rapidi dei contanti ricevuti, uguali su telefono e tablet: «Esatto» mette il totale, i tagli si sommano a ciò che
// c'è già (20 e poi 5 fanno 25) e la X azzera l'importo se si sbaglia un tocco. `received` è il testo del campo «Ricevuti».
const chip = 'h-10 coarse:h-11 px-3.5 inline-flex items-center justify-center text-center bg-[var(--bg-card)] border border-[var(--border)] text-sm font-medium tabular-nums rounded-lg flex-1 min-w-0 active:bg-[var(--accent)] active:text-white disabled:opacity-40 cursor-pointer';

const QuickCash = ({ total, received, onChange, disabled }) => (
  <div className="flex gap-2" role="group" aria-label="Contanti ricevuti">
    <button type="button" onClick={() => onChange(exactCash(total))} disabled={disabled} className={chip}>Esatto</button>
    {QUICK_CASH.map(amount => (
      <button key={amount} type="button" onClick={() => onChange(addCash(received, amount))} disabled={disabled} aria-label={`Aggiungi ${amount} €`} className={chip}>+{amount}</button>
    ))}
    {received !== '' && (
      <button type="button" onClick={() => onChange('')} aria-label="Azzera i contanti ricevuti" title="Azzera"
        className={`${chip} !flex-none !px-3 !text-[var(--text-muted)]`}><X size={16} /></button>
    )}
  </div>
);

export default QuickCash;
