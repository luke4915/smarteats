import { useEffect, useRef, useState } from 'react';

// Una riga che scorre in orizzontale (categorie, sezioni, filtri): il bordo da cui c'è ancora contenuto sfuma, così si
// capisce che si può scorrere (come nelle app native). Se tutto sta nella riga non sfuma niente. All'apertura porta in
// vista la voce attiva (`aria-selected` o `aria-current`). Prende le stesse proprietà di un <div>; `as` cambia l'elemento.
const FADE = 28;

const ScrollRow = ({ as = 'div', className = '', style, children, ...rest }) => {
  const Tag = as;
  const ref = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };
  useEffect(measure);                                  // anche quando cambia il contenuto
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const active = el.querySelector('[aria-selected="true"], [aria-current="page"]');
    if (active) el.scrollLeft += active.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - active.offsetWidth) / 2;
    return () => ro.disconnect();
  }, []);

  const mask = atStart && atEnd ? undefined
    : `linear-gradient(to right, ${atStart ? '#000' : `transparent, #000 ${FADE}px`}, ${atEnd ? '#000' : `#000 calc(100% - ${FADE}px), transparent`})`;
  return <Tag ref={ref} onScroll={measure} className={`overflow-x-auto no-scrollbar ${className}`} style={{ ...style, WebkitMaskImage: mask, maskImage: mask }} {...rest}>{children}</Tag>;
};

export default ScrollRow;
