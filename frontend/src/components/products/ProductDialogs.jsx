import Modal from '../shared/Modal';

// Le due conferme dell'editor dei prodotti: il nome c'è già, e l'eliminazione.
const secondary = 'h-10 rounded-xl border border-[var(--border)] text-[var(--text-main)] font-semibold text-xs hover:bg-[var(--bg-card-2)] transition-all cursor-pointer';

// `conflict` = { product, sameCategory } (vedi findNameConflict): nella stessa categoria si può solo rinunciare,
// in un'altra si può scegliere di usare la categoria del prodotto già esistente.
export const DuplicateDialog = ({ conflict, onUseCategory, onClose }) => (
  <Modal onClose={onClose} footer={
    <div className="flex flex-col gap-2">
      {!conflict.sameCategory && <button onClick={onUseCategory} className="w-full h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-xs transition-all cursor-pointer">Usa quella categoria</button>}
      <button onClick={onClose} className={`w-full ${secondary}`}>{conflict.sameCategory ? 'Ho capito' : 'Annulla'}</button>
    </div>}>
    <p className="font-semibold text-[var(--text-main)] mb-2 text-center">Prodotto già esistente</p>
    <p className="text-xs text-[var(--text-muted)] text-center">
      <b>"{conflict.product.name}"</b> esiste già {conflict.sameCategory ? 'in' : 'nella categoria'} <b>"{conflict.product.category}"</b>.{' '}
      {conflict.sameCategory ? 'Non puoi creare due prodotti identici nella stessa categoria.' : 'Non puoi creare due prodotti con lo stesso nome in categorie diverse.'}
    </p>
  </Modal>
);

export const DeleteDialog = ({ product, onConfirm, onClose }) => (
  <Modal onClose={onClose} footer={
    <div className="flex gap-3">
      <button onClick={onClose} className={`flex-1 ${secondary}`}>Annulla</button>
      <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-all cursor-pointer">Elimina</button>
    </div>}>
    <p className="font-semibold text-[var(--text-main)] mb-2 text-center">Eliminare il prodotto "{product.name}"?</p>
    <p className="text-xs text-[var(--text-muted)] text-center">L'azione è irreversibile!</p>
  </Modal>
);
