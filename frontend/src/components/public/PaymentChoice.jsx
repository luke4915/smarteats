import { CreditCard, Store, TriangleAlert } from 'lucide-react';
import { paymentChoices } from './paymentText';

// «Come paghi?» nell'ordine da asporto: con la carta adesso (Stripe, l'addebito parte solo se il locale accetta) oppure al ritiro. Se il locale
// pretende il pagamento online c'è una sola scelta; se i pagamenti non sono pronti l'ordine non si può inviare e si dice perché.
const OPTIONS = {
  online: { Icon: CreditCard, title: 'Paga ora con carta', hint: 'Addebitiamo solo se il locale accetta. Al ritiro non paghi nulla.' },
  on_pickup: { Icon: Store, title: 'Paga al ritiro', hint: 'Contanti o carta quando ritiri.' },
};

const PaymentChoice = ({ mode, value, onChange }) => {
  if (mode === 'unavailable') {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600" role="alert">
        <TriangleAlert size={18} className="shrink-0 mt-0.5" /> Al momento il pagamento online non è disponibile e questo locale lo richiede: riprova tra poco o telefona per ordinare.
      </p>
    );
  }
  const choices = paymentChoices(mode);
  if (choices.length < 2 && choices[0] === 'on_pickup') return null;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Come paghi">
      {choices.map(id => {
        const { Icon, title, hint } = OPTIONS[id];
        const on = value === id;
        return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onChange(id)} disabled={choices.length === 1}
            className={`w-full flex items-start gap-3 rounded-xl border p-3.5 text-left cursor-pointer disabled:cursor-default ${on ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
            <Icon size={20} className={`mt-0.5 shrink-0 ${on ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
            <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-[var(--text-muted)]">{hint}</span></span>
          </button>
        );
      })}
    </div>
  );
};

export default PaymentChoice;
