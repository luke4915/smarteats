import { useState } from 'react';

// Il pannello a destra che entra e esce con dolcezza (Sala, Prenotazioni): la sua colonna si allarga e si stringe, e l'area di
// lavoro accanto si adatta nello stesso movimento invece di saltare. Dopo la chiusura il contenuto resta fino alla fine
// dell'animazione, poi si toglie. Su schermo stretto il pannello è a tutto schermo e non passa da qui.
const SlidePanel = ({ open, children }) => {
  const [kept, setKept] = useState(children);        // l'ultimo contenuto mostrato: serve mentre il pannello si chiude
  const [mounted, setMounted] = useState(open);
  if (open && kept !== children) setKept(children);
  if (open && !mounted) setMounted(true);

  return (
    <div onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setMounted(false); }} inert={!open}
      className={`shrink-0 h-full overflow-hidden transition-[width,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'w-[380px] xl:w-[420px]' : 'w-0 -ml-4'}`}>
      {mounted && <div className="w-[380px] xl:w-[420px] h-full">{open ? children : kept}</div>}
    </div>
  );
};

export default SlidePanel;
