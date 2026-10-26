import { useState } from 'react';
import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import { btnDanger, input } from '../../smarteats/floor/ui';

// Conferma dell'eliminazione di un locale: si deve riscrivere il suo indirizzo, perché non si può annullare.
const DeleteTenantModal = ({ tenant, onConfirm, onClose }) => {
  const [typed, setTyped] = useState('');
  const ok = typed === tenant.slug;
  return (
    <Modal title={`Eliminare «${tenant.name}»?`} onClose={onClose} onSubmit={(e) => { e.preventDefault(); if (ok) onConfirm(); }}
      footer={<ModalActions fill onCancel={onClose}><button type="submit" disabled={!ok} className={btnDanger}>Elimina</button></ModalActions>}>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Non si può annullare: spariscono anche prodotti, ordini e utenti. Scrivi <b className="text-[var(--text-main)]">{tenant.slug}</b> per confermare.
      </p>
      <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder={tenant.slug} className={input} />
    </Modal>
  );
};

export default DeleteTenantModal;
