import { Eye, EyeOff } from 'lucide-react';
import { btn } from '../../smarteats/floor/ui';
import { selectionText } from './catalogView';

// La barra di «Seleziona»: resta in fondo allo schermo mentre si scorre l'elenco, così i pulsanti sono sempre sotto il pollice.
// Dice quanti prodotti ci sono, permette «Tutti / Nessuno» tra quelli in elenco e applica Mostra o Nascondi a tutta la selezione.
const SelectionBar = ({ count, noun, everySelected, onToggleAll, onShow, onHide, onDone, busy }) => (
  <div role="toolbar" aria-label="Selezione" className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
    <span aria-live="polite" className="flex-1 min-w-40 text-sm font-medium text-[var(--text-main)]">{selectionText(count, noun)}</span>
    <button type="button" onClick={onToggleAll} className={btn}>{everySelected ? 'Nessuno' : 'Tutti'}</button>
    <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
      <button type="button" onClick={onShow} disabled={count === 0 || busy} className={btn}><Eye size={16} className="shrink-0" /> Mostra</button>
      <button type="button" onClick={onHide} disabled={count === 0 || busy} className={btn}><EyeOff size={16} className="shrink-0" /> Nascondi</button>
      <button type="button" onClick={onDone} className={btn}>Fine</button>
    </div>
  </div>
);

export default SelectionBar;
