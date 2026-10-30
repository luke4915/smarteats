import { CreditCard } from 'lucide-react';
import { btnPrimary } from '../../smarteats/floor/ui';

// La nota sul pagamento nella pagina dell'ordine da asporto (testi in paymentText.js): verde se pagato, rossa se restituito o liberato,
// neutra mentre si aspetta. Se manca il pagamento c'è il pulsante per finirlo.
const TONES = { good: 'border-green-500/40 bg-green-500/5', bad: 'border-red-500/30 bg-red-500/5', waiting: 'border-[var(--border)] bg-[var(--bg-card-2)]' };

const PaymentBox = ({ note, onPay, busy }) => (
  <div className={`rounded-lg border px-4 py-3 space-y-2 ${TONES[note.tone]}`}>
    <p className="flex items-center gap-2 text-sm font-semibold"><CreditCard size={16} className="shrink-0" /> {note.title}</p>
    {note.body && <p className="text-sm text-[var(--text-muted)]">{note.body}</p>}
    {note.canPay && <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={onPay}>Completa il pagamento</button>}
  </div>
);

export default PaymentBox;
