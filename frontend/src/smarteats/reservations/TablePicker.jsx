import { useState, useMemo } from 'react';
import { Check, Users, Sparkles } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import FloorCanvas from '../floorplan/FloorCanvas';
import { isPlaced } from '../floorplan/geometry';
import PanelFrame from '../floor/PanelFrame';
import { btnPrimary, segment, segmentBox } from '../floor/ui';
import { tableTakenBy, suggestTables, tablesConnected } from './rules';
import { seatsLabel, effectiveMin } from '../floor/seats';

// Assegna uno o più tavoli a una prenotazione, sulla pianta della sala. Ogni tavolo mostra i suoi posti. Quelli già presi
// da un'altra prenotazione con orario sovrapposto sono bloccati e dicono da chi. Se la prenotazione non ha ancora
// tavoli, si parte da quello consigliato (meno posti vuoti possibile). I posti scelti devono bastare per il gruppo:
// il server ricontrolla tutto al salvataggio.
const TablePicker = ({ reservation, rooms, all, onBack, onSaved }) => {
  const { showToast } = useToast();
  const activeRooms = rooms.filter(r => r.active);
  const [roomId, setRoomId] = useState(() => activeRooms.find(r => r.tables.some(t => reservation.table_ids.includes(t.id)))?.id ?? activeRooms[0]?.id);
  const [busy, setBusy] = useState(false);
  const room = activeRooms.find(r => r.id === roomId);
  const party = reservation.party_size;

  const everyTable = useMemo(() => activeRooms.flatMap(r => r.tables.filter(t => t.active).map(t => ({ ...t, roomId: r.id }))), [activeRooms]);
  const takenBy = (tableId) => tableTakenBy(tableId, reservation, all);
  // Il consigliato: tra i tavoli liberi per quel turno, quello che spreca meno posti (o i pochi da unire)
  const suggestion = useMemo(
    () => suggestTables(party, everyTable.filter(t => !tableTakenBy(t.id, reservation, all)).map(t => ({ id: t.id, seats: t.seats, seatsMin: t.seats_min, roomId: t.roomId, x: t.x, y: t.y, w: t.w, h: t.h })), { preferRoomId: roomId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [everyTable, party, reservation, all]);
  const [selected, setSelected] = useState(() => (reservation.table_ids.length ? reservation.table_ids : suggestion?.ids ?? []));
  const [auto, setAuto] = useState(() => reservation.table_ids.length === 0 && !!suggestion);
  const seats = selected.reduce((s, id) => s + (everyTable.find(t => t.id === id)?.seats ?? 0), 0);
  const enough = seats >= party;
  const minNeeded = selected.reduce((s, id) => { const t = everyTable.find(x => x.id === id); return s + (t ? effectiveMin(t) : 0); }, 0);   // minimo dei tavoli scelti
  const belowMin = enough && party < minNeeded;
  const chosen = selected.map(id => everyTable.find(t => t.id === id)).filter(Boolean);
  const together = chosen.length < 2 || chosen.every(t => t.roomId === chosen[0].roomId) && tablesConnected(chosen);
  const useSuggestion = () => { if (suggestion) { setSelected(suggestion.ids); setAuto(true); setRoomId(everyTable.find(t => t.id === suggestion.ids[0])?.roomId ?? roomId); } };

  const toggle = (table) => {
    if (takenBy(table.id)) return showToast(`${table.name} è assegnato a ${takenBy(table.id).customer_name}`, 'warning');
    setAuto(false);
    setSelected(s => (s.includes(table.id) ? s.filter(id => id !== table.id) : [...s, table.id]));
  };
  const save = async () => {
    setBusy(true);
    try { onSaved(await fetchWithAuth(`/bookings/reservations/${reservation.id}/tables`, { method: 'PUT', body: { table_ids: selected } })); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const tableButton = (table, style = null, cell = 40) => {
    const on = selected.includes(table.id), other = takenBy(table.id);
    const suggested = !on && !other && suggestion?.ids.includes(table.id);
    const base = other ? 'border-red-500/50 bg-red-500/10 text-[var(--text-muted)] cursor-not-allowed'
      : on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border-hover)] bg-[var(--bg-card-2)] text-[var(--text-main)] hover:border-[var(--accent)]';
    return (
      <button key={table.id} style={style ?? undefined} aria-pressed={on}
        aria-label={`${table.name}, ${seatsLabel(table)} posti${other ? `: assegnato a ${other.customer_name}` : ''}${suggested ? ', consigliato' : ''}`}
        onClick={() => toggle(table)} title={other ? `${other.customer_name} · ${other.start_time}` : `${table.name}: ${seatsLabel(table)} posti`}
        className={`relative flex flex-col items-center justify-center border box-border overflow-hidden text-center transition ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${base} ${suggested ? '!border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : ''} ${style ? '' : 'min-h-14 px-2'}`}>
        <span className="font-semibold leading-none truncate max-w-full px-1" style={{ fontSize: style ? Math.max(14, Math.min(cell * 0.4, 20)) : 16 }}>{table.name}</span>
        {other
          ? <span className="text-xs leading-none mt-1 opacity-80 truncate max-w-full px-1">{other.customer_name}</span>
          : <span className="flex items-center gap-1 mt-1 font-semibold tabular-nums leading-none" style={{ fontSize: style ? Math.max(13, Math.min(cell * 0.34, 17)) : 15 }}>
            <Users size={style ? Math.max(13, Math.min(cell * 0.32, 17)) : 15} />{seatsLabel(table)}
          </span>}
        {on && <Check size={12} className="absolute top-0.5 right-0.5" />}
      </button>
    );
  };

  const placed = room?.tables.filter(t => t.active && isPlaced(t)) ?? [];
  // La pianta si ritaglia sui tavoli: i margini vuoti della sala non servono, e così i tavoli restano leggibili
  const crop = useMemo(() => {
    if (!room || !placed.length) return null;
    const items = [...placed, ...(room.elements ?? [])];
    const x0 = Math.max(0, Math.min(...items.map(i => i.x)) - 1), y0 = Math.max(0, Math.min(...items.map(i => i.y)) - 1);
    const x1 = Math.min(room.grid_w, Math.max(...items.map(i => i.x + i.w)) + 1), y1 = Math.min(room.grid_h, Math.max(...items.map(i => i.y + i.h)) + 1);
    const move = (i) => ({ ...i, x: i.x - x0, y: i.y - y0 });
    return { w: x1 - x0, h: y1 - y0, tables: placed.map(move), elements: (room.elements ?? []).map(move) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  const loose = room?.tables.filter(t => t.active && !isPlaced(t)) ?? [];

  return (
    <PanelFrame title="Tavoli" subtitle={`${reservation.customer_name} · ${reservation.party_size} persone · ${reservation.start_time}`} onBack={onBack}
      footer={
        <>
          {auto && selected.length > 0 && (
            <p className="text-xs text-[var(--accent)] flex items-center gap-1.5"><Sparkles size={13} /> {suggestion?.under ? 'Nessun tavolo ideale: questo è quello che spreca meno posti. Puoi cambiarlo.' : 'Preselezionato il più adatto: riempie meglio la sala. Puoi cambiarlo.'}</p>
          )}
          {!auto && suggestion && JSON.stringify([...selected].sort()) !== JSON.stringify([...suggestion.ids].sort()) && (
            <button className="text-xs text-[var(--accent)] font-medium cursor-pointer flex items-center gap-1.5" onClick={useSuggestion}>
              <Sparkles size={13} /> Usa il consigliato ({suggestion.ids.map(id => everyTable.find(t => t.id === id)?.name).join(' + ')} · {suggestion.seats} posti)
            </button>
          )}
          {!together && <p className="text-sm text-amber-500" role="status">I tavoli scelti sono lontani tra loro: difficile servirli come un gruppo.</p>}
          <p className={`text-sm ${selected.length && !enough ? 'text-amber-500' : 'text-[var(--text-muted)]'}`} role="status">
            {selected.length === 0 ? 'Tocca i tavoli da assegnare'
              : !enough ? `${seats} ${seats === 1 ? 'posto' : 'posti'} per ${party} persone: ne servono ancora ${party - seats}`
                : `${seats} posti per ${party} persone${seats - party > 0 ? ` · ${seats - party} ${seats - party === 1 ? 'vuoto' : 'vuoti'}` : ''}${belowMin ? ` · sotto il minimo consigliato (${minNeeded})` : ''}`}
          </p>
          <button className={`${btnPrimary} w-full !h-12`} disabled={busy || (selected.length > 0 && !enough)} onClick={save}>{selected.length ? 'Assegna' : 'Togli i tavoli'}</button>
        </>
      }>
      {activeRooms.length > 1 && (
        <div className={`${segmentBox} mb-2`} role="tablist" aria-label="Sala">
          {activeRooms.map(r => <button key={r.id} role="tab" aria-selected={r.id === roomId} className={segment(r.id === roomId)} onClick={() => setRoomId(r.id)}>{r.name}</button>)}
        </div>
      )}
      {!room && <p className="text-sm text-[var(--text-muted)] p-2">Nessuna sala: creala in Impostazioni.</p>}
      {room && crop && (
        <FloorCanvas minCell={24} maxCell={34} gridW={crop.w} gridH={crop.h} tables={crop.tables} elements={crop.elements}
          renderTable={(table, style, cell) => tableButton(table, style, cell)} />
      )}
      {loose.length > 0 && <div className="grid grid-cols-3 gap-2 pt-2">{loose.map(t => tableButton(t))}</div>}
    </PanelFrame>
  );
};

export default TablePicker;
