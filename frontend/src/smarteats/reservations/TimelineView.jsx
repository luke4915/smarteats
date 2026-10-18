import { useEffect, useRef, useState } from 'react';
import { timelineWindow, blocksForTable, unassigned, STEP, minutesNow, clockOf } from './timeline';
import { minutesOf } from './rules';
import { Users } from 'lucide-react';

const LABEL_W = 112;       // colonna dei tavoli
const ROW_H = 44;
const MIN_CELL = 20;

const BLOCK = {
  confirmed: 'bg-[var(--accent)]/20 border-[var(--accent)]/60 text-[var(--text-main)]',
  requested: 'bg-amber-500/15 border-amber-500/60 border-dashed text-[var(--text-main)]',
  seated: 'bg-emerald-500/20 border-emerald-500/60 text-[var(--text-main)]',
  walkin: 'bg-emerald-500/20 border-emerald-500/60 text-[var(--text-main)]',
};

// La giornata per tavolo: una riga per tavolo (raggruppate per sala), le ore in colonna, un blocco per ogni prenotazione
// o conto aperto. Una riga in cima raccoglie le prenotazioni senza tavolo. La linea rossa è l'ora di adesso (solo oggi).
// Un tocco su un blocco apre la prenotazione (o il conto); su una cella libera propone un walk-in a quel tavolo.
const TimelineView = ({ date, isToday, shifts, rooms, reservations, checks, selectedId, onOpenReservation, onOpenCheck, onFreeCell }) => {
  const [now, setNow] = useState(minutesNow());
  useEffect(() => { const t = setInterval(() => setNow(minutesNow()), 60000); return () => clearInterval(t); }, []);

  const openedMinutes = isToday ? checks.map(c => { const d = new Date(c.opened_at); return d.getHours() * 60 + d.getMinutes(); }) : [];
  const { start, end } = timelineWindow(shifts, reservations, openedMinutes);
  const cols = Math.ceil((end - start) / STEP);
  // La colonna si adatta alla larghezza: se tutta la giornata ci sta, niente scorrimento; altrimenti ha una misura minima leggibile
  const scroller = useRef(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const cell = Math.min(40, Math.max(MIN_CELL, Math.floor((boxW - LABEL_W - 2) / cols) || MIN_CELL));
  const x = (minutes) => ((Math.min(Math.max(minutes, start), end) - start) / STEP) * cell;
  const width = cols * cell;
  const hours = [];
  for (let m = Math.ceil(start / 60) * 60; m < end; m += 60) hours.push(m);
  const waiting = unassigned(reservations);
  // All'apertura la vista si porta sull'ora di adesso (oggi) o sulla prima prenotazione del giorno
  const firstStart = reservations.filter(r => ['requested', 'confirmed', 'seated'].includes(r.status)).map(r => minutesOf(r.start_time)).sort((a, b) => a - b)[0];
  useEffect(() => {
    const target = isToday ? now - 30 : firstStart;
    if (scroller.current && target != null) scroller.current.scrollLeft = Math.max(0, x(target));
    // solo quando cambia giorno o finestra: non si deve spostare mentre il personale scorre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, start, end]);
  const activeRooms = rooms.filter(r => r.active && r.tables.some(t => t.active));

  const bar = (b, tone) => (
    <button key={`${b.kind}-${b.id}`} onClick={() => (b.kind === 'check' ? onOpenCheck(b.id) : onOpenReservation(b.id))}
      title={`${b.time} · ${b.title} · ${b.party}`} aria-label={`${b.time} ${b.title}, ${b.party} persone`}
      className={`absolute top-1 bottom-1 rounded-md border px-2 flex items-center gap-1.5 text-xs font-medium overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 ${tone} ${b.kind === 'reservation' && b.id === selectedId ? 'ring-2 ring-[var(--text-main)]' : ''}`}
      style={{ left: x(b.start), width: Math.max(cell * 2, x(b.end) - x(b.start) - 2) }}>
      <span className="tabular-nums opacity-80">{b.time}</span><span className="truncate">{b.title}</span><span className="tabular-nums opacity-80 ml-auto flex items-center gap-1 shrink-0"><Users size={12} aria-hidden="true" />{b.party}</span>
    </button>
  );

  const row = (key, label, sub, content, tableId) => (
    <div key={key} className="flex border-b border-[var(--border)]" style={{ height: ROW_H }}>
      <div className="sticky left-0 z-10 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border)] px-3 flex items-center justify-between gap-2" style={{ width: LABEL_W }}>
        <span className="text-sm font-medium text-[var(--text-main)] truncate">{label}</span>{sub != null && <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums shrink-0" title={`${sub} ${sub === 1 ? 'posto' : 'posti'}`}><Users size={12} aria-hidden="true" />{sub}</span>}
      </div>
      <div className="relative shrink-0" style={{ width, backgroundImage: `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${cell * 4}px)` }}
        onClick={tableId && isToday ? (e) => {
          if (e.target !== e.currentTarget) return;
          const at = start + Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / cell) * STEP;
          onFreeCell(tableId, at);
        } : undefined}>
        {content}
      </div>
    </div>
  );

  return (
    <div ref={scroller} className="flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] relative" role="region" aria-label={`Timeline dei tavoli del ${date}`}>
      <div style={{ width: LABEL_W + width }} className="relative">
        <div className="sticky top-0 z-20 flex bg-[var(--bg-card)] border-b border-[var(--border)]" style={{ height: 32 }}>
          <div className="sticky left-0 z-10 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border)] px-3 flex items-center text-xs text-[var(--text-muted)]" style={{ width: LABEL_W }}>Tavolo</div>
          <div className="relative shrink-0" style={{ width }}>
            {hours.map(m => <span key={m} className="absolute top-0 h-full flex items-center text-xs tabular-nums text-[var(--text-muted)] pl-1.5 border-l border-[var(--border)]" style={{ left: x(m) }}>{clockOf(m)}</span>)}
          </div>
        </div>

        {waiting.length > 0 && row('waiting', 'Da assegnare', waiting.length, waiting.map(r => bar({ kind: 'reservation', id: r.id, title: r.customer_name, party: r.party_size, time: r.start_time, start: minutesOf(r.start_time), end: minutesOf(r.start_time) + Number(r.duration_minutes) }, BLOCK[r.status])))}

        {activeRooms.map(room => (
          <div key={room.id}>
            <div className="py-1 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-card-2)] border-b border-[var(--border)]" style={{ width: LABEL_W + width }}><span className="sticky left-3 px-3">{room.name}</span></div>
            {room.tables.filter(t => t.active).map(t => row(t.id, t.name, t.seats,
              blocksForTable(t.id, reservations, checks, { isToday, nowMin: now }).map(b => bar(b, BLOCK[b.status])), t.id))}
          </div>
        ))}

        {isToday && now >= start && now <= end && (
          <div className="absolute z-[5] w-px bg-red-500 pointer-events-none" style={{ left: LABEL_W + x(now), top: 32, bottom: 0 }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default TimelineView;
