import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Larghezze ammesse. Dal tablet in su la finestra è una scheda centrata; sul telefono è sempre a tutta larghezza (una scheda
// che sale dal basso), per questo la classe `sm:` va scritta per intero: Tailwind non la ricava da un pezzo di stringa.
const WIDTHS = {
  'max-w-sm': 'sm:max-w-sm', 'max-w-md': 'sm:max-w-md', 'max-w-lg': 'sm:max-w-lg', 'max-w-2xl': 'sm:max-w-2xl',
  'max-w-3xl': 'sm:max-w-3xl', 'max-w-4xl': 'sm:max-w-4xl',
};

// La finestra di dialogo di SmartEats, nello stile delle schede di iOS: sul telefono sale dal basso e si appoggia al bordo,
// altrove è una scheda centrata. Sfondo sfocato su tutto lo schermo (menu e testata compresi: la finestra sta sulla `body`
// e non dentro la pagina, dove un contenitore animato la intrappolerebbe), sempre dentro lo schermo (il corpo scorre, titolo
// e piede restano fermi). Si chiude con Esc e, se `dismissOnBackdrop`, toccando lo sfondo (da spegnere nei moduli lunghi:
// un tocco sbagliato non deve far perdere ciò che si è scritto).
//   title     intestazione (senza, la finestra è una semplice conferma)
//   footer    i pulsanti in fondo, sempre visibili (di solito `ModalActions`). **Se c'è il piede, la X non compare**: il modo
//             di uscire è «Annulla» o «Chiudi» lì dentro. Senza piede la X in alto a destra è l'unica uscita visibile.
//   onSubmit  se c'è, corpo e piede formano un <form> (il pulsante `type="submit"` invia)
//   size      larghezza massima dal tablet in su: classe Tailwind (default `max-w-sm`)
// Regola dello stile (CLAUDE.md): le finestre servono per conferme e moduli lunghi; il resto sta nel pannello a destra.
const SWIPE_CLOSE_PX = 110;      // di quanto si trascina la scheda verso il basso per chiuderla
const PHONE = '(max-width: 639px)';

const Modal = ({ title, onClose, footer, onSubmit, size = 'max-w-sm', dismissOnBackdrop = true, children }) => {
  const sheet = useRef(null);

  // Sul telefono la scheda si chiude trascinandola verso il basso dalla maniglia o dal titolo, come in iOS. Nei moduli lunghi
  // (`dismissOnBackdrop` spento) no: un gesto sbagliato non deve far perdere ciò che si è scritto.
  const startSwipe = (e) => {
    if (!dismissOnBackdrop || !window.matchMedia(PHONE).matches || e.target.closest('button')) return;
    const card = sheet.current;
    const startY = e.clientY;
    let distance = 0;
    card.style.transition = 'none';
    const move = (ev) => { distance = Math.max(0, ev.clientY - startY); card.style.transform = `translateY(${distance}px)`; };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      card.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
      if (distance > SWIPE_CLOSE_PX) { card.style.transform = 'translateY(100%)'; setTimeout(onClose, 180); } else card.style.transform = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  useEffect(() => {
    const closeOnEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const Layout = onSubmit ? 'form' : 'div';
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex items-end sm:items-center justify-center sm:p-6 bg-black/40 backdrop-blur-md"
      onMouseDown={dismissOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}>
      <div ref={sheet} role="dialog" aria-modal="true" aria-label={title}
        className={`modal-sheet w-full ${WIDTHS[size] ?? WIDTHS['max-w-sm']} max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.55)]`}>
        <div onPointerDown={startSwipe} className="touch-none shrink-0">
          <span className="sm:hidden block mx-auto mt-2 h-1 w-9 rounded-full bg-[var(--border-hover)]/50" aria-hidden="true" />
          {title && (
            <div className="flex justify-between items-center gap-3 px-5 sm:px-6 pt-4 sm:pt-5 pb-3">
              <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text-main)] truncate">{title}</h3>
              {!footer && (
                <button type="button" onClick={onClose} aria-label="Chiudi"
                  className="shrink-0 w-8 h-8 coarse:w-9 coarse:h-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-card-2)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"><X size={15} /></button>
              )}
            </div>
          )}
        </div>
        <Layout onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className={`px-5 sm:px-6 pb-5 overflow-y-auto overscroll-contain min-h-0 flex-1 ${title ? '' : 'pt-5 sm:pt-6'}`}>{children}</div>
          {footer && <div className="px-5 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-[var(--border)]/70 shrink-0">{footer}</div>}
        </Layout>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
