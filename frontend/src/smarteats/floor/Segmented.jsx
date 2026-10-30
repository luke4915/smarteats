import { segment, segmentBox } from './ui';
import ScrollRow from '../../components/shared/ScrollRow';

// L'interruttore a più scelte di SmartEats (Timeline | Elenco, Piatti | Opzioni, le sale…): una sola riga, la scelta
// attiva in rilievo. Si usa ovunque serva scegliere fra poche viste o filtri: niente schede o chip fatti a mano.
// `options`: [{ id, label, disabled? }]; `size="lg"` per gli schermi di lavoro da lontano (la cucina);
// Ogni scelta è `type="button"`: dentro un modulo un pulsante senza tipo lo invierebbe (errore o salvataggio a ogni tocco).
// `scroll`: le scelte si distribuiscono su tutta la larghezza e, se sono troppe per starci, scorrono in orizzontale (le sale, le categorie).
const Segmented = ({ options, value, onChange, label, size = 'md', scroll = false, className = '' }) => {
  const Box = scroll ? ScrollRow : 'div';
  return (
    <Box className={`${segmentBox} ${className}`} role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} disabled={o.disabled} onClick={() => onChange(o.id)}
          className={`${segment(o.id === value)} ${size === 'lg' ? '!h-11 !text-lg px-5' : 'px-3'} ${scroll ? '!flex-auto min-w-fit' : ''} whitespace-nowrap disabled:opacity-40`}>{o.label}</button>
      ))}
    </Box>
  );
};

export default Segmented;
