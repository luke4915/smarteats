import Segmented from '../shared/Segmented';
import { PAPER_OPTIONS } from '../../print/paper';

// La scelta della carta di una stampante (58 o 80 mm), uguale nella cassa delle sagre e nel ristorante: da lei dipende quanto stanno larghe le righe
// dello scontrino. Senza scelta vale 80 mm, come sempre.
const PaperWidthChoice = ({ value = 80, onChange, disabled = false, label = 'Carta' }) => (
  <div className={`flex items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <span className="text-xs text-[var(--text-muted)]">Carta</span>
    <Segmented label={label} value={value} onChange={onChange} options={PAPER_OPTIONS.map(p => ({ id: p.mm, label: p.label }))} />
  </div>
);

export default PaperWidthChoice;
