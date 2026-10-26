import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import { btnDanger } from '../../smarteats/floor/ui';

// Conferma prima di uscire dall'account.
const LogoutConfirmModal = ({ onConfirm, onCancel }) => (
  <Modal title="Uscire dall'account?" onClose={onCancel}
    footer={<ModalActions fill onCancel={onCancel}><button type="button" onClick={onConfirm} className={btnDanger}>Esci</button></ModalActions>}>
    <p className="text-sm text-[var(--text-muted)]">Gli ordini non ancora inviati restano salvati su questo dispositivo.</p>
  </Modal>
);

export default LogoutConfirmModal;
