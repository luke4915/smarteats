import { useState, useRef, useCallback, useEffect } from 'react';
import { LONG_PRESS_MS, pressProgress, pressFired, pressSwallowsClick } from '../utils/longPress';

// Tenere premuta una tessera (di partenza 1 secondo) fa una cosa diversa dal tocco normale: nella cassa apre la disponibilità del
// prodotto. Con il mouse vale anche il tasto destro (subito). Le regole di tempo stanno in `utils/longPress.js`. Ritorna:
//   progress(id)       da 0 a 100: serve a riempire la tessera mentre si tiene premuto
//   bind(id, item)     i gestori da mettere sull'elemento (mouse, dito, tasto destro)
//   blocksClick(id)    da chiamare nel click: vero se il gesto era una pressione lunga (o un ripensamento) e il tocco normale non va eseguito
export function useLongPress(onLongPress, delay = LONG_PRESS_MS) {
  const [progressById, setProgressById] = useState({});
  const timers = useRef({});   // { [id]: { raf, startTime, triggered } }
  const lastTouch = useRef(-Infinity);

  const clear = useCallback((id) => {
    const t = timers.current[id];
    if (t?.raf) cancelAnimationFrame(t.raf);
    delete timers.current[id];
    setProgressById(prev => { if (!(id in prev)) return prev; const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const fire = useCallback((item) => {
    try { navigator.vibrate?.(12); } catch { /* il telefono non vibra: pazienza */ }
    onLongPress(item);
  }, [onLongPress]);

  const start = useCallback((id, item) => {
    if (timers.current[id]) return;                          // già in corso
    const state = { startTime: performance.now(), triggered: false, raf: null };
    timers.current[id] = state;
    const tick = () => {
      const elapsed = performance.now() - state.startTime;
      if (pressFired(elapsed, delay)) { state.triggered = true; fire(item); clear(id); return; }
      setProgressById(prev => ({ ...prev, [id]: pressProgress(elapsed, delay) }));
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }, [clear, delay, fire]);

  useEffect(() => () => Object.values(timers.current).forEach(t => t.raf && cancelAnimationFrame(t.raf)), []);

  const blocksClick = useCallback((id) => {
    const t = timers.current[id];
    const block = !!t && (t.triggered || pressSwallowsClick(performance.now() - t.startTime));
    clear(id);
    return block;
  }, [clear]);

  const bind = (id, item) => ({
    onMouseDown: (e) => { if (e.button === 0) start(id, item); },
    onMouseLeave: () => clear(id),
    onTouchStart: () => { lastTouch.current = performance.now(); start(id, item); },
    onTouchCancel: () => clear(id),
    // Il tasto destro del mouse (o il tasto «menu» della tastiera) apre subito. Sul telefono il sistema manda lo stesso evento dopo
    // mezzo secondo: lo si ignora, perché vale il secondo intero.
    onContextMenu: (e) => {
      e.preventDefault();
      if (performance.now() - lastTouch.current < 2000) return;
      clear(id);
      fire(item);
    },
  });
  return { progress: (id) => progressById[id] ?? 0, bind, blocksClick };
}
