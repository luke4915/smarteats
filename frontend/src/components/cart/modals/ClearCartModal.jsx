import Modal from '../../shared/Modal';
import { btn, btnDanger } from '../../../smarteats/floor/ui';

// Conferma prima di svuotare il carrello.
const ClearCartModal = ({ onConfirm, onClose }) => (
  <Modal title="Svuotare il carrello?" onClose={onClose}
    footer={<div className="flex gap-3"><button onClick={onClose} className={`${btn} flex-1`}>Annulla</button><button onClick={() => { onConfirm(); onClose(); }} className={`${btnDanger} flex-1`}>Svuota</button></div>}>
    <p className="text-sm text-[var(--text-muted)]">Tutti gli articoli verranno rimossi.</p>
  </Modal>
);

export default ClearCartModal;
