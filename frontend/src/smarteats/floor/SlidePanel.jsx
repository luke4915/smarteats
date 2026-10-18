import { useState } from 'react';
import { usePanelWidth } from './usePanelReserve';

// Il pannello a destra (Sala, Prenotazioni) come un foglio che scorre sopra l'area di lavoro: si muove solo con una
// traslazione (transform), che il browser anima senza ricalcolare nulla, quindi resta fluido. L'area di lavoro non cambia
// misura a scatti: sposta o riduce in modo morbido il proprio contenuto di `reserve` pixel (vedi `usePanelReserve.js`).
// Va dentro un contenitore `relative`. Dopo la chiusura il contenuto resta fino alla fine del movimento, poi si toglie.
const SlidePanel = ({ open, children }) => {
  const width = usePanelWidth();
  const [kept, setKept] = useState(children);        // l'ultimo contenuto mostrato: serve mentre il pannello si chiude
  const [mounted, setMounted] = useState(open);
  if (open && kept !== children) setKept(children);
  if (open && !mounted) setMounted(true);

  return (
    <div style={{ width }} inert={!open}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setMounted(false); }}
      className={`absolute right-0 top-0 bottom-0 z-10 transition-[transform,box-shadow] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${open ? 'translate-x-0 shadow-[-28px_0_40px_-28px_rgba(0,0,0,0.55)]' : 'translate-x-[calc(100%+1.5rem)]'}`}>
      {mounted && <div className="h-full">{open ? children : kept}</div>}
    </div>
  );
};

export default SlidePanel;
