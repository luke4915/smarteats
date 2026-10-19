import { useState, useLayoutEffect, useRef } from 'react';
import { clamp, isPlaced } from './geometry';
import { ELEMENT_CLASS } from './elementStyle';

// Griglia di una sala con i suoi tavoli. Serve sia all'editor (tavoli trascinabili) sia alla Sala (tavoli con lo
// stato dal vivo): cosa disegnare dentro a ogni tavolo lo decide `renderTable(table, style)`, che deve applicare
// `style` (posizione e misura in pixel) al suo elemento. La cella si adatta alla larghezza disponibile; con `fit`
// (la Sala) si adatta anche all'altezza: l'intera sala sta nell'area, in alto e centrata, senza scroll. `fit` richiede un
// contenitore con altezza definita. Senza `fit`, `minCell` è la misura minima di una cella: una sala molto grande
// scorre in orizzontale invece di rimpicciolire i tavoli fino a non leggerli.
const MIN_CELL = 14;
const MAX_CELL = 56;
const MIN_FIT_CELL = 8;

const FloorCanvas = ({ gridW, gridH, tables, elements = [], renderTable, renderElement, showGrid = false, fit = false, reserve = 0, focusTable = null, minCell = MIN_CELL, maxCell = MAX_CELL, onBackgroundPointerDown, onBackgroundPointerMove, onBackgroundPointerUp, canvasRef }) => {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cell = fit ? Math.max(MIN_FIT_CELL, Math.floor(Math.min(size.w / gridW, size.h / gridH) || 0)) : clamp(Math.floor(size.w / gridW) || 32, minCell, maxCell);

  // `reserve` + `focusTable` (solo con `fit`): un pannello copre la destra. La pianta resta della misura piena e, se il tavolo
  // scelto finirebbe sotto il pannello, scivola di lato quanto basta a lasciarlo in vista (mai oltre il bordo sinistro).
  // Si sposta con un transform, che il browser anima in modo fluido; se il tavolo è già visibile non si muove. Mentre è
// spostata, il bordo sinistro sfuma (`--fade`, vedi `.floor-fade` in index.css) invece di tagliare i tavoli di netto.
  let transform = 'translate(0px, 0px)';
  let shifted = false;
  if (fit && reserve > 0 && focusTable && size.w > 0) {
    const MARGIN = 16;
    const left = (size.w - gridW * cell) / 2;                         // dove sta la pianta a riposo
    const tableLeft = left + focusTable.x * cell;
    const tableRight = left + (focusTable.x + focusTable.w) * cell;
    const needed = Math.min(0, size.w - reserve - MARGIN - tableRight);   // quanto spostare a sinistra
    const dx = Math.max(needed, MARGIN - tableLeft);                       // ma il tavolo non esce a sinistra
    transform = `translate(${Math.min(0, dx)}px, 0px)`;
    shifted = dx < -1;
  }

  return (
    <div ref={box} className={fit ? 'w-full h-full flex items-center justify-center overflow-hidden floor-fade' : 'w-full overflow-x-auto no-scrollbar'}
      style={fit ? { '--fade': shifted ? '72px' : '0px' } : undefined}>
      <div
        ref={canvasRef}
        onPointerDown={onBackgroundPointerDown} onPointerMove={onBackgroundPointerMove} onPointerUp={onBackgroundPointerUp} onPointerCancel={onBackgroundPointerUp}
        className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-card-2)] select-none"
        style={{
          width: gridW * cell, height: gridH * cell,
          ...(fit && { transform, transition: 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)' }),
          ...(showGrid && {
            backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
            backgroundSize: `${cell}px ${cell}px`,
          }),
        }}>
        {elements.map(e => {
          const style = { position: 'absolute', left: e.x * cell, top: e.y * cell, width: e.w * cell, height: e.h * cell };
          return renderElement ? renderElement(e, style, cell)
            : <div key={e.id} style={style} aria-hidden="true" className={`pointer-events-none box-border ${ELEMENT_CLASS[e.kind]}`} />;
        })}
        {tables.filter(isPlaced).map(t => renderTable(t, {
          position: 'absolute', left: t.x * cell, top: t.y * cell, width: t.w * cell, height: t.h * cell,
        }, cell))}
      </div>
    </div>
  );
};

export default FloorCanvas;
