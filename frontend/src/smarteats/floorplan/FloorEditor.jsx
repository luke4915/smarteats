import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Undo2, Redo2, Save, Minus, Plus, Square, Circle, Eraser, Wand2, MousePointer2, SeparatorVertical } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import FloorCanvas from './FloorCanvas';
import Segmented from '../floor/Segmented';
import { useDraft } from './useDraft';
import { conflictIds, moveBy, resizeBy, resizeFrom, defaultSize, findFreeSpot, isPlaced, clamp, lineBetween, HANDLES } from './geometry';
import { ELEMENT_CLASS } from './elementStyle';

const toDraft = (room) => ({
  gridW: room.grid_w, gridH: room.grid_h,
  tables: room.tables.map(({ id, name, seats, active, x, y, w, h, shape }) => ({ id, name, seats, active, x, y, w, h, shape })),
  // id solo lato client ("e12" salvati, "n3" nuovi): il server li risalva tutti insieme alla pianta
  elements: (room.elements ?? []).map(({ id, kind, x, y, w, h }) => ({ id: `e${id}`, kind, x, y, w, h })),
});
const TOOLS = [
  { id: 'select', name: 'Seleziona', icon: MousePointer2 },
  { id: 'divider', name: 'Separatore', icon: SeparatorVertical },
];
const unplaced = { x: null, y: null, w: null, h: null };
const MAX_ELEMENT_SIDE = 60;

const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-main)] font-medium text-sm hover:bg-[var(--bg-card-2)] disabled:opacity-40 transition-colors';
const numInput = 'w-16 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] text-sm text-center outline-none focus:ring-2 focus:ring-[var(--accent)]';
const label = 'text-xs font-medium text-[var(--text-muted)]';

const Stepper = ({ name, value, min, max, onChange }) => (
  <div className="flex items-center gap-1" role="group" aria-label={name}>
    <button className={`${btn} px-2`} aria-label={`Riduci ${name}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={12} /></button>
    <span className="w-8 text-center font-semibold text-[var(--text-main)]">{value}</span>
    <button className={`${btn} px-2`} aria-label={`Aumenta ${name}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={12} /></button>
  </div>
);

// Posizione e cursore di ogni maniglia attorno all'oggetto selezionato
const HANDLE_STYLE = {
  nw: { left: -6, top: -6, cursor: 'nwse-resize' }, n: { left: '50%', top: -6, marginLeft: -6, cursor: 'ns-resize' },
  ne: { right: -6, top: -6, cursor: 'nesw-resize' }, e: { right: -6, top: '50%', marginTop: -6, cursor: 'ew-resize' },
  se: { right: -6, bottom: -6, cursor: 'nwse-resize' }, s: { left: '50%', bottom: -6, marginLeft: -6, cursor: 'ns-resize' },
  sw: { left: -6, bottom: -6, cursor: 'nesw-resize' }, w: { left: -6, top: '50%', marginTop: -6, cursor: 'ew-resize' },
};

// Editor della pianta di una sala (solo admin). Tavoli e separatori funzionano allo stesso modo: si trascinano sulla
// griglia con scatto alla cella e, selezionati, hanno maniglie agli angoli e ai lati per ridimensionarli. Con la
// tastiera: frecce = sposta, Maiusc+frecce = ridimensiona, Canc = elimina o toglie dalla pianta, Ctrl+Z / Ctrl+Y =
// annulla / ripristina. Si salva tutto insieme, e solo se nulla è sovrapposto o fuori dalla sala.
const FloorEditor = ({ room, onClose, onSaved }) => {
  const { showToast } = useToast();
  const initial = useMemo(() => toDraft(room), [room]);
  const { draft, commit, startGesture, update, endGesture, undo, redo, canUndo, canRedo } = useDraft(initial);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [tool, setTool] = useState('select');   // select | divider
  const [ghost, setGhost] = useState(null);
  const drag = useRef(null);
  const drawing = useRef(null);
  const canvasRef = useRef(null);
  const newId = useRef(0);

  const { gridW, gridH, tables, elements } = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const conflicts = useMemo(() => conflictIds(tables, gridW, gridH, elements), [tables, gridW, gridH, elements]);
  const selected = tables.find(t => t.id === selectedId);
  const selectedEl = elements.find(e => e.id === selectedId);
  const pending = tables.filter(t => !isPlaced(t));

  // Tavoli ed elementi si trattano con le stesse funzioni: `patchItem` cambia quello con quell'id, ovunque sia.
  const isElement = (id) => typeof id === 'string';
  const itemOf = (id) => (isElement(id) ? elements.find(e => e.id === id) : tables.find(t => t.id === id));
  const patchItem = (id, patch) => (isElement(id)
    ? { ...draft, elements: elements.map(e => (e.id === id ? { ...e, ...patch } : e)) }
    : { ...draft, tables: tables.map(t => (t.id === id ? { ...t, ...patch } : t)) });
  const maxSide = (id) => (isElement(id) ? MAX_ELEMENT_SIDE : undefined);
  const requestClose = () => (dirty ? setConfirmExit(true) : onClose());

  const place = (table) => {
    const { w, h } = defaultSize(table.seats);
    const spot = findFreeSpot(tables, gridW, gridH, w, h);
    if (!spot) return showToast('Non c\'è più spazio libero: ingrandisci la sala', 'warning');
    commit(patchItem(table.id, { ...spot, w, h }));
    setSelectedId(table.id);
  };
  const placeAll = () => {
    let next = tables;
    for (const t of next.filter(x => !isPlaced(x))) {
      const { w, h } = defaultSize(t.seats);
      const spot = findFreeSpot(next, gridW, gridH, w, h);
      if (!spot) { showToast('Spazio esaurito: alcuni tavoli restano da piazzare', 'warning'); break; }
      next = next.map(x => (x.id === t.id ? { ...x, ...spot, w, h } : x));
    }
    commit({ ...draft, tables: next });
  };
  const removeSelected = () => {
    if (isElement(selectedId)) commit({ ...draft, elements: elements.filter(e => e.id !== selectedId) });
    else commit(patchItem(selectedId, unplaced));
    setSelectedId(null);
  };
  const setGrid = (key, value) => commit({ ...draft, [key]: clamp(Number(value) || 4, 4, 60) });

  // Tastiera. Non interferisce con i campi di testo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); return redo(); }
      if (e.key === 'Escape') return requestClose();
      const item = selectedId !== null ? itemOf(selectedId) : null;
      if (!item || !isPlaced(item)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return removeSelected(); }
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!step) return;
      e.preventDefault();
      commit(patchItem(item.id, e.shiftKey ? resizeBy(item, step[0], step[1], gridW, gridH) : moveBy(item, step[0], step[1], gridW, gridH)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Trascinamento e ridimensionamento con i pointer events (mouse, dito, penna): `mode` è `move` o `resize:<maniglia>`.
  const beginDrag = (e, id, mode, cell) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    drag.current = { id, mode, cell, startX: e.clientX, startY: e.clientY, origin: { ...itemOf(id) } };
    startGesture();
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.startX) / d.cell), dy = Math.round((e.clientY - d.startY) / d.cell);
    const patch = d.mode === 'move' ? moveBy(d.origin, dx, dy, gridW, gridH)
      : resizeFrom(d.origin, d.mode.split(':')[1], dx, dy, gridW, gridH, maxSide(d.id));
    update(patchItem(d.id, patch));
  };
  const endDrag = () => { drag.current = null; endGesture(); };

  // Separatori: si traccia una linea trascinando da una cella all'altra; un tocco è una cella sola. Appena disegnato
  // si torna a «Seleziona» e il separatore è già scelto, con le sue maniglie.
  const cellAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cell = rect.width / gridW;
    return { x: clamp(Math.floor((e.clientX - rect.left) / cell), 0, gridW - 1), y: clamp(Math.floor((e.clientY - rect.top) / cell), 0, gridH - 1) };
  };
  const backgroundDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (tool === 'select') return setSelectedId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const from = cellAt(e);
    drawing.current = from;
    setGhost({ id: 'ghost', kind: 'divider', ...lineBetween(from, from) });
  };
  const backgroundMove = (e) => {
    if (drawing.current) setGhost({ id: 'ghost', kind: 'divider', ...lineBetween(drawing.current, cellAt(e)) });
  };
  const backgroundUp = (e) => {
    if (!drawing.current) return;
    const line = lineBetween(drawing.current, cellAt(e));
    drawing.current = null;
    setGhost(null);
    const id = `n${++newId.current}`;
    commit({ ...draft, elements: [...elements, { id, kind: 'divider', ...line }] });
    setSelectedId(id);
    setTool('select');
  };

  // Non è un componente: ridefinito a ogni ridisegno verrebbe smontato a metà trascinamento e il gesto si perderebbe.
  const renderHandles = (id, cell) => HANDLES.map(h => (
    <span key={h} role="separator" aria-label={`Ridimensiona (${h})`} data-handle={h}
      onPointerDown={e => beginDrag(e, id, `resize:${h}`, cell)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      className="absolute w-3 h-3 rounded-full bg-[var(--bg-card)] border-2 border-[var(--accent)] z-20" style={{ touchAction: 'none', ...HANDLE_STYLE[h] }} />
  ));

  const renderElement = (el, style, cell) => {
    const bad = conflicts.has(el.id), isSel = el.id === selectedId, isGhost = el.id === 'ghost';
    return (
      <div key={el.id} style={{ ...style, touchAction: 'none' }} role="button" aria-label="Separatore"
        onPointerDown={e => !isGhost && beginDrag(e, el.id, 'move', cell)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        className={`${isGhost ? 'opacity-50 pointer-events-none' : tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'} ${isSel ? 'z-10' : ''}`}>
        <div className={`w-full h-full ${ELEMENT_CLASS[el.kind]} ${bad ? '!bg-red-500/70' : ''} ${isSel ? 'ring-2 ring-[var(--accent)]' : ''}`} />
        {isSel && tool === 'select' && renderHandles(el.id, cell)}
      </div>
    );
  };

  const renderTable = (t, style, cell) => {
    const bad = conflicts.has(t.id), isSel = t.id === selectedId;
    return (
      <div key={t.id} style={{ ...style, touchAction: 'none' }} role="button" aria-label={`Tavolo ${t.name}`}
        onPointerDown={e => beginDrag(e, t.id, 'move', cell)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        className={`${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''} ${isSel ? 'z-10' : ''} ${t.active ? '' : 'opacity-50'}`}>
        <div className={`w-full h-full flex flex-col items-center justify-center border-2 box-border overflow-hidden ${t.shape === 'round' ? 'rounded-full' : 'rounded-lg'}
          ${bad ? 'border-red-500 bg-red-500/20' : 'border-[var(--accent)] bg-[var(--accent)]/15'} ${isSel ? 'ring-2 ring-offset-1 ring-[var(--text-main)]' : ''}`}>
          <span className="font-semibold text-[var(--text-main)] leading-none truncate max-w-full px-1" style={{ fontSize: Math.max(10, Math.min(cell * 0.45, 18)) }}>{t.name}</span>
          {cell >= 24 && t.h > 1 && <span className="text-[var(--text-muted)] leading-none mt-0.5" style={{ fontSize: Math.max(9, cell * 0.3) }}>{t.seats} posti</span>}
        </div>
        {isSel && tool === 'select' && renderHandles(t.id, cell)}
      </div>
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetchWithAuth(`/rooms/${room.id}/layout`, {
        method: 'PUT',
        body: { grid_w: gridW, grid_h: gridH, tables: tables.map(({ id, x, y, w, h, shape }) => ({ id, x, y, w, h, shape })),
          elements: elements.map(({ kind, x, y, w, h }) => ({ kind, x, y, w, h })) },
      });
      showToast('Pianta salvata', 'success');
      await onSaved();
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const item = selected && isPlaced(selected) ? selected : selectedEl;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-[var(--bg-main)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="mr-auto min-w-0">
          <p className={label}>Pianta della sala</p>
          <h2 className="text-lg font-semibold text-[var(--text-main)] truncate">{room.name}</h2>
        </div>
        <button className={btn} onClick={undo} disabled={!canUndo} aria-label="Annulla"><Undo2 size={14} /></button>
        <button className={btn} onClick={redo} disabled={!canRedo} aria-label="Ripristina"><Redo2 size={14} /></button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm disabled:opacity-40"
          onClick={save} disabled={!dirty || conflicts.size > 0 || saving}><Save size={14} /> {saving ? 'Salvataggio…' : 'Salva'}</button>
        <button className={btn} onClick={requestClose} aria-label="Chiudi"><X size={14} /></button>
      </header>

      {confirmExit && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center gap-3 text-sm text-[var(--text-main)]">
          <span className="mr-auto">Hai modifiche non salvate.</span>
          <button className={btn} onClick={() => setConfirmExit(false)}>Continua a modificare</button>
          <button className="px-3 py-2 rounded-lg bg-red-500 text-white font-medium text-sm" onClick={onClose}>Esci senza salvare</button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 overflow-auto">
        <div className="flex-1 min-w-0 space-y-3">
          <div className={tool === 'select' ? '' : 'cursor-crosshair'}>
            <FloorCanvas gridW={gridW} gridH={gridH} tables={tables} elements={ghost ? [...elements, ghost] : elements} showGrid
              renderTable={renderTable} renderElement={renderElement} canvasRef={canvasRef}
              onBackgroundPointerDown={backgroundDown} onBackgroundPointerMove={backgroundMove} onBackgroundPointerUp={backgroundUp} />
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {tool === 'select'
              ? 'Trascina tavoli e separatori. Le maniglie sul bordo cambiano la misura. Frecce per spostare, Maiusc+frecce per ridimensionare, Canc per toglierli.'
              : 'Trascina sulla griglia per tracciare il separatore; un tocco ne mette una cella.'}
          </p>
          {conflicts.size > 0 && <p className="text-sm font-medium text-red-500">Qualcosa è sovrapposto a un tavolo o esce dalla sala (in rosso): sistemalo per poter salvare.</p>}
        </div>

        <aside className="lg:w-72 shrink-0 space-y-4">
          <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
            <p className={label}>Dimensioni della sala</p>
            <div className="flex items-center gap-2 text-sm text-[var(--text-main)]">
              <input className={numInput} type="number" min={4} max={60} aria-label="Larghezza della sala" value={gridW} onChange={e => setGrid('gridW', e.target.value)} />
              <span>×</span>
              <input className={numInput} type="number" min={4} max={60} aria-label="Altezza della sala" value={gridH} onChange={e => setGrid('gridH', e.target.value)} />
            </div>
            <p className="text-xs text-[var(--text-muted)]">Larghezza × altezza, in quadretti della griglia.</p>
          </section>

          <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
            <p className={label}>Strumento</p>
            <Segmented label="Strumento" value={tool} onChange={setTool}
              options={TOOLS.map(t => { const Icon = t.icon; return { id: t.id, label: <span className="inline-flex items-center gap-1.5"><Icon size={14} aria-hidden="true" />{t.name}</span> }; })} />
          </section>

          <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
            <div className="flex items-center justify-between">
              <p className={label}>Da piazzare ({pending.length})</p>
              {pending.length > 1 && <button className={btn} onClick={placeAll}><Wand2 size={12} /> Tutti</button>}
            </div>
            {pending.length === 0
              ? <p className="text-sm text-[var(--text-muted)]">Tutti i tavoli sono sulla pianta. I nuovi si creano in Impostazioni → Sala e tavoli.</p>
              : <div className="flex flex-wrap gap-2">{pending.map(t => (
                <button key={t.id} className={btn} onClick={() => place(t)} title="Piazza sulla pianta">{t.name}<span className="text-[var(--text-muted)]">{t.seats}p</span></button>
              ))}</div>}
          </section>

          <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
            <p className={label}>{selectedEl ? 'Separatore selezionato' : 'Tavolo selezionato'}</p>
            {item ? (
              <>
                {selected && <p className="font-semibold text-[var(--text-main)]">{selected.name} <span className="font-normal text-[var(--text-muted)] text-sm">· {selected.seats} posti</span></p>}
                <div className="flex items-center justify-between"><span className="text-sm text-[var(--text-main)]">Larghezza</span>
                  <Stepper name="larghezza" value={item.w} min={1} max={Math.min(selectedEl ? MAX_ELEMENT_SIDE : 30, gridW - item.x)} onChange={w => commit(patchItem(item.id, { w }))} /></div>
                <div className="flex items-center justify-between"><span className="text-sm text-[var(--text-main)]">Altezza</span>
                  <Stepper name="altezza" value={item.h} min={1} max={Math.min(selectedEl ? MAX_ELEMENT_SIDE : 30, gridH - item.y)} onChange={h => commit(patchItem(item.id, { h }))} /></div>
                {selected && (
                  <div className="flex gap-2">
                    <button className={`${btn} flex-1 justify-center ${selected.shape === 'rect' ? 'bg-[var(--bg-card-2)]' : ''}`} onClick={() => commit(patchItem(selected.id, { shape: 'rect' }))}><Square size={12} /> Rettangolare</button>
                    <button className={`${btn} flex-1 justify-center ${selected.shape === 'round' ? 'bg-[var(--bg-card-2)]' : ''}`} onClick={() => commit(patchItem(selected.id, { shape: 'round' }))}><Circle size={12} /> Tondo</button>
                  </div>
                )}
                <button className={`${btn} w-full justify-center hover:text-red-500`} onClick={removeSelected}><Eraser size={12} /> {selectedEl ? 'Elimina il separatore' : 'Togli dalla pianta'}</button>
              </>
            ) : <p className="text-sm text-[var(--text-muted)]">Tocca un tavolo o un separatore sulla pianta per cambiarne misura.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default FloorEditor;
