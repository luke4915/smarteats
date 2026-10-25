import Segmented from '../../smarteats/floor/Segmented';
import { label, input } from '../../smarteats/floor/ui';

const RULES = [
  { id: 'unlimited', label: 'Illimitate' },
  { id: 'restart_each_service', label: 'Da N a ogni servizio' },
  { id: 'carry_over', label: 'Continua dal servizio prima' },
];
const HINTS = {
  unlimited: 'Nessun limite: il piatto si può sempre ordinare.',
  restart_each_service: 'A ogni apertura del servizio le porzioni tornano a questo numero. Quando finiscono il piatto si nasconde da solo.',
  carry_over: 'Le porzioni restano quelle di fine servizio (una torta fatta per due giorni).',
};

// Le porzioni di un piatto (col modulo magazzino): quante se ne contano e cosa succede all'apertura del servizio.
// Mostra e modifica `portions_reset_rule`, `portions_start` e, per «continua dal servizio prima», le porzioni di adesso (`stock`).
const PortionsField = ({ form, onChange }) => (
  <div className="space-y-3">
    <span className={`${label} block`}>Porzioni</span>
    <Segmented scroll label="Regola delle porzioni" options={RULES} value={form.portions_reset_rule} onChange={(rule) => onChange({ portions_reset_rule: rule })} />
    <p className="text-sm text-[var(--text-muted)]">{HINTS[form.portions_reset_rule]}</p>
    {form.portions_reset_rule === 'restart_each_service' && (
      <label className="block">
        <span className={`${label} block mb-1`}>Porzioni di partenza</span>
        <input type="number" inputMode="numeric" min="1" className={input} value={form.portions_start} onChange={e => onChange({ portions_start: e.target.value })} />
      </label>
    )}
    {form.portions_reset_rule === 'carry_over' && (
      <label className="block">
        <span className={`${label} block mb-1`}>Porzioni disponibili adesso</span>
        <input type="number" inputMode="numeric" min="0" className={input} value={form.stock} onChange={e => onChange({ stock: e.target.value })} />
      </label>
    )}
  </div>
);

export default PortionsField;
