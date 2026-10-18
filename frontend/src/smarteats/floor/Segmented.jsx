import { segment, segmentBox } from './ui';

// L'interruttore a più scelte di SmartEats (Timeline | Elenco, Piatti | Opzioni, le sale…): una sola riga, la scelta
// attiva in rilievo. Si usa ovunque serva scegliere fra poche viste o filtri: niente schede o chip fatti a mano.
// `options`: [{ id, label, disabled? }]; `size="lg"` per gli schermi di lavoro da lontano (la cucina);
// `scroll` fa scorrere le scelte in orizzontale quando sono molte (le sale, le categorie).
const Segmented = ({ options, value, onChange, label, size = 'md', scroll = false, className = '' }) => (
  <div className={`${segmentBox} ${scroll ? 'overflow-x-auto no-scrollbar' : ''} ${className}`} role="tablist" aria-label={label}>
    {options.map(o => (
      <button key={o.id} role="tab" aria-selected={o.id === value} disabled={o.disabled} onClick={() => onChange(o.id)}
        className={`${segment(o.id === value)} ${size === 'lg' ? '!h-11 !text-lg px-5' : 'px-3'} ${scroll ? 'flex-none whitespace-nowrap' : ''} disabled:opacity-40`}>{o.label}</button>
    ))}
  </div>
);

export default Segmented;
