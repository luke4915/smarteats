import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import FloorCanvas from '../floor/FloorCanvas';
import { isPlaced } from '../floor/geometry';
import PanelFrame from '../sala/PanelFrame';
import { btnPrimary, segment, segmentBox } from '../sala/ui';
import { tableTakenBy } from './rules';

// Assegna uno o più tavoli a una prenotazione, sulla pianta della sala. Quelli già presi da un'altra prenotazione con
// orario sovrapposto sono bloccati e dicono da chi. Il server ricontrolla tutto al salvataggio.
const TablePicker = ({ reservation, rooms, all, onBack, onSaved }) => {
  const { showToast } = useToast();
  const activeRooms = rooms.filter(r => r.active);
  const [roomId, setRoomId] = useState(() => activeRooms.find(r => r.tables.some(t => reservation.table_ids.includes(t.id)))?.id ?? activeRooms[0]?.id);
  const [selected, setSelected] = useState(reservation.table_ids);
  const [busy, setBusy] = useState(false);
  const room = activeRooms.find(r => r.id === roomId);

  const everyTable = useMemo(() => activeRooms.flatMap(r => r.tables), [activeRooms]);
  const seats = selected.reduce((s, id) => s + (everyTable.find(t => t.id === id)?.seats ?? 0), 0);
  const takenBy = (tableId) => tableTakenBy(tableId, reservation, all);

  const toggle = (table) => {
    if (takenBy(table.id)) return showToast(`${table.name} è assegnato a ${takenBy(table.id).customer_name}`, 'warning');
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
    const base = other ? 'border-red-500/50 bg-red-500/10 text-[var(--text-muted)] cursor-not-allowed'
      : on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border-hover)] bg-[var(--bg-card-2)] text-[var(--text-main)] hover:border-[var(--accent)]';
    return (
      <button key={table.id} style={style ?? undefined} aria-pressed={on} aria-label={`${table.name}${other ? `: assegnato a ${other.customer_name}` : ''}`}
        onClick={() => toggle(table)} title={other ? `${other.customer_name} · ${other.start_time}` : `${table.seats} posti`}
        className={`flex flex-col items-center justify-center border box-border overflow-hidden text-center transition ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${base} ${style ? '' : 'min-h-14 px-2'}`}>
        <span className="font-semibold leading-none truncate max-w-full px-1" style={style ? { fontSize: Math.max(12, Math.min(cell * 0.5, 18)) } : undefined}>{table.name}</span>
        {(!style || cell >= 22) && <span className="text-xs leading-none mt-0.5 opacity-80 truncate max-w-full px-1">{other ? other.customer_name : `${table.seats} posti`}</span>}
        {on && <Check size={12} className="mt-0.5" />}
      </button>
    );
  };

  const placed = room?.tables.filter(t => t.active && isPlaced(t)) ?? [];
  const loose = room?.tables.filter(t => t.active && !isPlaced(t)) ?? [];

  return (
    <PanelFrame title="Tavoli" subtitle={`${reservation.customer_name} · ${reservation.party_size} persone · ${reservation.start_time}`} onBack={onBack}
      footer={
        <>
          <p className={`text-sm ${selected.length && seats < reservation.party_size ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
            {selected.length === 0 ? 'Tocca i tavoli da assegnare' : `${seats} posti per ${reservation.party_size} persone${seats < reservation.party_size ? ': non bastano' : ''}`}
          </p>
          <button className={`${btnPrimary} w-full !h-12`} disabled={busy} onClick={save}>{selected.length ? 'Assegna' : 'Togli i tavoli'}</button>
        </>
      }>
      {activeRooms.length > 1 && (
        <div className={`${segmentBox} mb-2`} role="tablist" aria-label="Sala">
          {activeRooms.map(r => <button key={r.id} role="tab" aria-selected={r.id === roomId} className={segment(r.id === roomId)} onClick={() => setRoomId(r.id)}>{r.name}</button>)}
        </div>
      )}
      {!room && <p className="text-sm text-[var(--text-muted)] p-2">Nessuna sala: creala in Impostazioni.</p>}
      {room && placed.length > 0 && (
        <div className="w-full" style={{ aspectRatio: `${room.grid_w} / ${room.grid_h}` }}>
          <FloorCanvas fit gridW={room.grid_w} gridH={room.grid_h} tables={placed} elements={room.elements}
            renderTable={(table, style, cell) => tableButton(table, style, cell)} />
        </div>
      )}
      {loose.length > 0 && <div className="grid grid-cols-3 gap-2 pt-2">{loose.map(t => tableButton(t))}</div>}
    </PanelFrame>
  );
};

export default TablePicker;
