import { useState, useRef, useCallback, useEffect } from 'react';

const VISIBLE_AT = 10;   // % sotto cui non si disegna nulla: un tocco veloce non deve far lampeggiare la barra

// Tenere premuto a lungo un elemento (di partenza 1,5 s) fa una cosa diversa dal tocco normale: nella cassa apre la modifica rapida
// di un prodotto. Ritorna:
//   progress(id)       da 0 a 100: serve a riempire la tessera mentre si tiene premuto
//   bind(id, item)     i gestori da mettere sull'elemento (mouse, dito, menu del tasto destro)
//   blocksClick(id)    da chiamare nel click: vero se il gesto era una pressione lunga, e il tocco normale non va eseguito
export function useLongPress(onLongPress, delay = 1500) {
  const [progressById, setProgressById] = useState({});
  const timers = useRef({});   // { [id]: { raf, startTime, triggered, exceeded } }

  const clear = useCallback((id) => {
    const t = timers.current[id];
    if (t?.raf) cancelAnimationFrame(t.raf);
    delete timers.current[id];
    setProgressById(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const start = useCallback((id, item) => {
    if (timers.current[id]) return;                          // già in corso
    const state = { startTime: performance.now(), triggered: false, exceeded: false, raf: null };
    timers.current[id] = state;
    const tick = () => {
      const percent = Math.min(100, ((performance.now() - state.startTime) / delay) * 100);
      setProgressById(prev => ({ ...prev, [id]: percent }));
      if (percent > VISIBLE_AT) state.exceeded = true;
      if (percent >= 100) { state.triggered = true; onLongPress(item); clear(id); return; }
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }, [clear, delay, onLongPress]);

  useEffect(() => () => Object.values(timers.current).forEach(t => t.raf && cancelAnimationFrame(t.raf)), []);

  const blocksClick = useCallback((id) => {
    const t = timers.current[id];
    const block = !!(t?.triggered || t?.exceeded);
    clear(id);
    return block;
  }, [clear]);

  const bind = (id, item) => ({
    onMouseDown: () => start(id, item), onMouseLeave: () => clear(id),
    onTouchStart: () => start(id, item), onTouchCancel: () => clear(id),
    onContextMenu: (e) => e.preventDefault(),
  });
  return { progress: (id) => progressById[id] ?? 0, bind, blocksClick, visibleAt: VISIBLE_AT };
}
