// Le due conferme dell'editor dei prodotti: il nome c'è già, e l'eliminazione.
const Dialog = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <div className="relative w-full max-w-sm bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-2xl p-6" onClick={e => e.stopPropagation()}>{children}</div>
  </div>
);

const secondary = 'h-10 rounded-xl border border-[var(--border)] text-[var(--text-main)] font-semibold text-xs hover:bg-[var(--bg-card-2)] transition-all cursor-pointer';

// `conflict` = { product, sameCategory } (vedi findNameConflict): nella stessa categoria si può solo rinunciare,
// in un'altra si può scegliere di usare la categoria del prodotto già esistente.
export const DuplicateDialog = ({ conflict, onUseCategory, onClose }) => (
  <Dialog onClose={onClose}>
    <p className="font-semibold text-[var(--text-main)] mb-2 text-center">Prodotto già esistente</p>
    <p className="text-xs text-[var(--text-muted)] mb-4 text-center">
      <b>"{conflict.product.name}"</b> esiste già {conflict.sameCategory ? 'in' : 'nella categoria'} <b>"{conflict.product.category}"</b>.{' '}
      {conflict.sameCategory ? 'Non puoi creare due prodotti identici nella stessa categoria.' : 'Non puoi creare due prodotti con lo stesso nome in categorie diverse.'}
    </p>
    <div className="flex flex-col gap-2">
      {!conflict.sameCategory && <button onClick={onUseCategory} className="w-full h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-xs transition-all cursor-pointer">Usa quella categoria</button>}
      <button onClick={onClose} className={`w-full ${secondary}`}>{conflict.sameCategory ? 'Ho capito' : 'Annulla'}</button>
    </div>
  </Dialog>
);

export const DeleteDialog = ({ product, onConfirm, onClose }) => (
  <Dialog onClose={onClose}>
    <p className="font-semibold text-[var(--text-main)] mb-2 text-center">Eliminare il prodotto "{product.name}"?</p>
    <p className="text-xs text-[var(--text-muted)] mb-4 text-center">L'azione è irreversibile!</p>
    <div className="flex gap-3">
      <button onClick={onClose} className={`flex-1 ${secondary}`}>Annulla</button>
      <button onClick={onConfirm} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-all cursor-pointer">Elimina</button>
    </div>
  </Dialog>
);
