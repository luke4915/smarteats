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

const FloorCanvas = ({ gridW, gridH, tables, elements = [], renderTable, renderElement, showGrid = false, fit = false, reserve = 0, minCell = MIN_CELL, maxCell = MAX_CELL, onBackgroundPointerDown, onBackgroundPointerMove, onBackgroundPointerUp, canvasRef }) => {
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

  // `reserve` (solo con `fit`): un pannello copre la destra. La pianta non si ridisegna: resta della misura piena e si
  // rimpicciolisce e si sposta con un transform, che il browser anima in modo fluido (e si ferma a metà senza scatti).
  let transform = 'translate(0px, 0px) scale(1)';
  if (fit && reserve > 0 && size.w > 0) {
    const availW = Math.max(size.w - reserve, gridW * MIN_FIT_CELL);
    const scale = Math.min(1, Math.min(availW / gridW, size.h / gridH) / cell);
    transform = `translate(${(availW - gridW * cell * scale) / 2 - (size.w - gridW * cell) / 2}px, 0px) scale(${scale})`;
  }

  return (
    <div ref={box} className={fit ? 'w-full h-full flex items-start justify-center overflow-hidden' : 'w-full overflow-x-auto no-scrollbar'}>
      <div
        ref={canvasRef}
        onPointerDown={onBackgroundPointerDown} onPointerMove={onBackgroundPointerMove} onPointerUp={onBackgroundPointerUp} onPointerCancel={onBackgroundPointerUp}
        className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-card-2)] select-none"
        style={{
          width: gridW * cell, height: gridH * cell,
          ...(fit && { transform, transformOrigin: '0 0', transition: 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)' }),
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
