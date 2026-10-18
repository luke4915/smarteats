import Modal from '../shared/Modal';
import { btn, btnDanger } from '../../smarteats/floor/ui';

// Conferma prima di uscire dall'account.
const LogoutConfirmModal = ({ onConfirm, onCancel }) => (
  <Modal title="Uscire dall'account?" onClose={onCancel}
    footer={<div className="flex gap-3"><button onClick={onCancel} className={`${btn} flex-1`}>Annulla</button><button onClick={onConfirm} className={`${btnDanger} flex-1`}>Esci</button></div>}>
    <p className="text-sm text-[var(--text-muted)]">Gli ordini non ancora inviati restano salvati su questo dispositivo.</p>
  </Modal>
);

export default LogoutConfirmModal;
