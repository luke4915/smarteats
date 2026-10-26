import Modal from '../../shared/Modal';
import ModalActions from '../../shared/ModalActions';
import { btnDanger } from '../../../smarteats/floor/ui';

// Conferma prima di svuotare il carrello.
const ClearCartModal = ({ onConfirm, onClose }) => (
  <Modal title="Svuotare il carrello?" onClose={onClose}
    footer={<ModalActions fill onCancel={onClose}><button type="button" onClick={() => { onConfirm(); onClose(); }} className={btnDanger}>Svuota</button></ModalActions>}>
    <p className="text-sm text-[var(--text-muted)]">Tutti gli articoli verranno rimossi.</p>
  </Modal>
);

export default ClearCartModal;
