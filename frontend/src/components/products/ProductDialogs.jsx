import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import { btnPrimary, btnDanger } from '../../smarteats/floor/ui';

// Le due conferme dell'editor dei prodotti: il nome c'è già, e l'eliminazione.

// `conflict` = { product, sameCategory } (vedi findNameConflict): nella stessa categoria si può solo rinunciare,
// in un'altra si può scegliere di usare la categoria del prodotto già esistente.
export const DuplicateDialog = ({ conflict, onUseCategory, onClose }) => (
  <Modal title="Prodotto già esistente" onClose={onClose} footer={
    <ModalActions fill onCancel={onClose} cancelLabel={conflict.sameCategory ? 'Ho capito' : 'Annulla'}>
      {!conflict.sameCategory && <button type="button" onClick={onUseCategory} className={btnPrimary}>Usa quella categoria</button>}
    </ModalActions>}>
    <p className="text-sm text-[var(--text-muted)]">
      <b className="text-[var(--text-main)]">«{conflict.product.name}»</b> esiste già {conflict.sameCategory ? 'in' : 'nella categoria'} <b className="text-[var(--text-main)]">«{conflict.product.category}»</b>.{' '}
      {conflict.sameCategory ? 'Non puoi creare due prodotti identici nella stessa categoria.' : 'Non puoi creare due prodotti con lo stesso nome in categorie diverse.'}
    </p>
  </Modal>
);

export const DeleteDialog = ({ product, onConfirm, onClose }) => (
  <Modal title={`Eliminare «${product.name}»?`} onClose={onClose} footer={
    <ModalActions fill onCancel={onClose}><button type="button" onClick={onConfirm} className={btnDanger}>Elimina</button></ModalActions>}>
    <p className="text-sm text-[var(--text-muted)]">L'azione non si può annullare.</p>
  </Modal>
);
