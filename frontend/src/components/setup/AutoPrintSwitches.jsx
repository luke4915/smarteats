import { useState } from 'react';
import Switch from '../shared/Switch';
import { autoPrintOn, setAutoPrint } from '../../print/autoPrint';

// Le stampe automatiche di questo dispositivo (vedi print/autoPrint.js). `receipt`: solo dove ci sono i conti dei tavoli; `takeaway`: dove c'è l'asporto.
const Line = ({ name, title, hint }) => {
  const [on, setOn] = useState(() => autoPrintOn(name));
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text-main)]">{title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>
      </div>
      <Switch label={title} checked={on} onChange={(v) => { setOn(v); setAutoPrint(name, v); }} />
    </div>
  );
};

const AutoPrintSwitches = ({ receipt = false, takeaway = false }) => (
  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
    <div className="p-5 pb-3">
      <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Stampa automatica su questo dispositivo</h2>
      <p className="text-xs text-[var(--text-muted)] max-w-xl">Vale solo per questo dispositivo, che deve raggiungere la stampante. Spenta, si stampa a mano.</p>
    </div>
    {receipt && <Line name="receipt" title="Ricevuta dopo ogni incasso" hint="Esce da sola alla stampante del conto appena si incassa." />}
    {takeaway && <Line name="takeaway" title="Comanda dell'asporto accettato" hint="Quando accetti un ordine che va in cucina oggi, la comanda esce alla stampante della cucina. Utile solo se la cucina lavora su carta." />}
  </div>
);

export default AutoPrintSwitches;
