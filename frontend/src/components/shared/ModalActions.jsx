import { btn } from '../../smarteats/floor/ui';

// I pulsanti in fondo a una finestra (il `footer` di `Modal`), uguali ovunque: «Annulla» e l'azione a destra (sul telefono in
// due metà a tutta larghezza).
//   onCancel     cosa fa «Annulla» (di solito chiude la finestra)
//   cancelLabel  il testo di chi esce: «Annulla» nei moduli, «Chiudi» o «Continua» dove è più chiaro
//   note         una riga di riepilogo o il motivo per cui l'azione non è ancora possibile: a sinistra, sul telefono sopra i pulsanti
//   start        un'azione in disparte a sinistra, per esempio «Elimina»
//   fill         conferme brevi: le due scelte occupano metà larghezza ciascuna, anche su schermo grande
//   children     l'azione principale: un `<button>` (`btnPrimary` o `btnDanger`)
const ModalActions = ({ onCancel, cancelLabel = 'Annulla', note, start, fill = false, children }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    {note && <div className="min-w-0 text-sm text-[var(--text-muted)] sm:flex-1">{note}</div>}
    <div className={`flex items-center gap-2 ${fill ? 'flex-1' : note ? '' : 'sm:flex-1'}`}>
      {start}
      <div className={`flex flex-1 gap-2 [&>button]:flex-1 ${fill ? '' : 'sm:flex-none sm:ml-auto sm:[&>button]:flex-none'}`}>
        <button type="button" className={btn} onClick={onCancel}>{cancelLabel}</button>
        {children}
      </div>
    </div>
  </div>
);

export default ModalActions;
