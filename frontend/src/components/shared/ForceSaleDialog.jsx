import Modal from './Modal';
import { btn, btnPrimary } from '../../smarteats/floor/ui';

// La domanda «Vendi comunque?» (vedi hooks/useForceSale.js): un ingrediente è finito o non basta, ma chi gestisce può decidere di vendere.
const ForceSaleDialog = ({ message, onAnswer }) => (
  <Modal title="Ingrediente esaurito" size="max-w-md" dismissOnBackdrop={false} onClose={() => onAnswer(false)}
    footer={(
      <div className="flex justify-end gap-3">
        <button type="button" className={btn} onClick={() => onAnswer(false)}>Annulla</button>
        <button type="button" className={btnPrimary} onClick={() => onAnswer(true)}>Vendi comunque</button>
      </div>)}>
    <div className="space-y-2">
      <p className="text-sm text-[var(--text-main)]">{message}</p>
      <p className="text-sm text-[var(--text-muted)]">Se vendi comunque, in dispensa la quantità scende sotto zero: ricordati di correggerla con un controllo di magazzino.</p>
    </div>
  </Modal>
);

export default ForceSaleDialog;
