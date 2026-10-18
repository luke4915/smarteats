import { useEffect } from 'react';
import { X } from 'lucide-react';

// La finestra di dialogo di SmartEats: sfondo scuro, scheda centrata, sempre dentro lo schermo (il corpo scorre, titolo e
// piede restano fermi). Si chiude con Esc e, se `dismissOnBackdrop`, toccando lo sfondo (da spegnere nei moduli lunghi:
// un tocco sbagliato non deve far perdere ciò che si è scritto).
//   title     intestazione con la X (senza, la finestra è una semplice conferma)
//   footer    i pulsanti in fondo, sempre visibili
//   onSubmit  se c'è, corpo e piede formano un <form> (il pulsante `type="submit"` invia)
//   size      larghezza massima: classe Tailwind (default `max-w-sm`)
// Regola dello stile (CLAUDE.md): le finestre servono per conferme e moduli lunghi; il resto sta nel pannello a destra.
const Modal = ({ title, onClose, footer, onSubmit, size = 'max-w-sm', dismissOnBackdrop = true, children }) => {
  useEffect(() => {
    const closeOnEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const Layout = onSubmit ? 'form' : 'div';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={dismissOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${size} max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-2xl`}>
        {title && (
          <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border)] shrink-0">
            <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">{title}</h3>
            <button type="button" onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-xl hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer"><X size={16} className="text-[var(--text-muted)]" /></button>
          </div>
        )}
        <Layout onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 overflow-y-auto min-h-0 flex-1">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-[var(--border)] shrink-0">{footer}</div>}
        </Layout>
      </div>
    </div>
  );
};

export default Modal;
