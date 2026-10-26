import { useState, useEffect, useRef } from 'react';

// Un menu a comparsa (account, notifiche, «⋯»): si apre e si chiude toccando il pulsante, toccando fuori o con Esc.
// `ref` va sul contenitore che racchiude pulsante e menu.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, ref, toggle: () => setOpen(o => !o), close: () => setOpen(false) };
}
