import { useRef, useState } from 'react';
import { reorder, nearestIndex, shiftFor } from './sortable';

// Elenco riordinabile per trascinamento, uguale in tutta l'app (portate, stampe…): una maniglia per riga, le altre righe
// si scostano per far posto e la riga scivola al suo posto quando la si lascia. Funziona con mouse e dito; da tastiera
// la maniglia si sposta con le frecce su e giù.
//
//   <SortableList items={list} getId={(x) => x.id} onReorder={(next) => …}
//     renderItem={(item, { handleProps, isDragging, index }) => <div><button {...handleProps}><GripVertical /></button>…</div>} />
const SortableList = ({ items, getId, onReorder, renderItem, disabled = false, className = '', gap = 8 }) => {
  const refs = useRef(new Map());
  const info = useRef(null);
  const [drag, setDrag] = useState(null);       // { id, from, to, offset, step, settling }

  const begin = (id) => (e) => {
    if (disabled || drag) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntatore già rilasciato */ }
    const rects = items.map(it => refs.current.get(getId(it))?.getBoundingClientRect());
    const from = items.findIndex(it => getId(it) === id);
    if (from === -1 || rects.some(r => !r)) return;
    const centers = rects.map(r => r.top + r.height / 2);
    info.current = { id, from, startY: e.clientY, centers, step: rects[from].height + gap };
    setDrag({ id, from, to: from, offset: 0, step: info.current.step, settling: false });
  };

  const move = (e) => {
    const d = info.current;
    if (!d || drag?.settling) return;
    const offset = e.clientY - d.startY;
    setDrag(cur => (cur ? { ...cur, offset, to: nearestIndex(d.centers, d.centers[d.from] + offset) } : cur));
  };

  const end = (e) => {
    const d = info.current;
    if (!d || !drag || drag.settling) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* già rilasciato */ }
    const to = drag.to;
    // la riga scivola esattamente nel suo posto, poi si aggiorna l'ordine senza altre animazioni
    setDrag({ ...drag, offset: to === d.from ? 0 : d.centers[to] - d.centers[d.from], settling: true });
    setTimeout(() => {
      info.current = null;
      setDrag(null);
      if (to !== d.from) onReorder(reorder(items, d.from, to));
    }, 180);
  };

  const key = (index) => (e) => {
    if (disabled || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (to >= 0 && to < items.length) onReorder(reorder(items, index, to));
  };

  return (
    <ul className={className} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((item, index) => {
        const id = getId(item);
        const isDragging = drag?.id === id;
        const y = !drag ? 0 : isDragging ? drag.offset : shiftFor(index, drag.from, drag.to, drag.step);
        return (
          <li key={id} ref={el => { if (el) refs.current.set(id, el); else refs.current.delete(id); }}
            style={{ position: 'relative', zIndex: isDragging ? 10 : undefined, transform: y ? `translateY(${y}px)` : undefined,
              transition: isDragging && !drag.settling ? 'none' : 'transform 180ms ease', opacity: isDragging && !drag.settling ? 0.95 : 1 }}>
            {renderItem(item, {
              index, isDragging,
              handleProps: {
                role: 'button', tabIndex: disabled ? -1 : 0, 'aria-label': 'Trascina per riordinare',
                onPointerDown: begin(id), onPointerMove: move, onPointerUp: end, onPointerCancel: end, onKeyDown: key(index),
                style: { touchAction: 'none', cursor: disabled ? 'default' : 'grab' },
              },
            })}
          </li>
        );
      })}
    </ul>
  );
};

export default SortableList;
