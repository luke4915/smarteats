import { useState } from 'react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { Users, Receipt } from 'lucide-react';
import FloorCanvas from '../floorplan/FloorCanvas';
import { isPlaced } from '../floorplan/geometry';
import { tableState, formatEuro } from './checkMath';
import { segment, segmentBox } from './ui';

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const STATE_STYLE = {
  free: 'border-[var(--border-hover)] bg-[var(--bg-card-2)] text-[var(--text-muted)]',
  busy: 'border-[var(--accent)]/70 bg-[var(--accent)]/10 text-[var(--text-main)]',
  bill: 'border-amber-500/80 bg-amber-500/10 text-[var(--text-main)]',
};
const STATE_LABEL = { free: 'Libero', busy: 'Occupato', bill: 'Conto richiesto' };
const interactive = 'cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';
const ring = 'ring-2 ring-offset-2 ring-offset-[var(--bg-card)] ring-[var(--text-main)]';

// Scheda di un tavolo (per i tavoli non ancora piazzati sulla pianta)
const TableCard = ({ table, check, reservation, selected, onSelect }) => {
  const state = tableState(check);
  return (
    <button disabled={!table.active} onClick={() => onSelect(table, check)} aria-label={`${table.name}: ${STATE_LABEL[state]}`}
      className={`text-left rounded-lg border p-3.5 min-h-[104px] flex flex-col justify-between ${STATE_STYLE[state]} ${table.active ? interactive : 'opacity-40'} ${selected ? ring : ''}`}>
      <div className="w-full">
        <span className="block text-2xl font-semibold leading-none text-[var(--text-main)]">{table.name}</span>
        <span className="mt-2 flex items-center gap-1.5 text-base font-medium tabular-nums text-[var(--text-muted)]"><Users size={16} aria-hidden="true" />{check ? check.covers : table.seats}</span>
      </div>
      <div className="text-xs">
        <p className="font-semibold">{table.active ? STATE_LABEL[state] : 'Non in uso'}</p>
        {check && <p className="mt-0.5 flex items-center gap-1.5 text-[var(--text-muted)]"><Receipt size={12} /> {formatEuro(check.total)} · {minutesSince(check.opened_at)} min</p>}
        {!check && reservation && <p className="mt-0.5 font-medium text-[var(--accent)] truncate">{reservation.start_time} · {reservation.customer_name} · {reservation.party_size}</p>}
        {check?.ready_items > 0 && <p className="mt-0.5 font-semibold text-emerald-500">{check.ready_items} {check.ready_items === 1 ? "pronto" : "pronti"}</p>}
      </div>
    </button>
  );
};

// Un tavolo sulla pianta: forma e misura scelte dall'admin, colore dallo stato.
const mapTable = (checkOf, reservedOf, selectedId, onSelect) => (table, style, cell) => {
  const check = checkOf(table);
  const reservation = !check ? reservedOf(table) : null;
  const state = tableState(check);
  return (
    <button key={table.id} style={style} disabled={!table.active} onClick={() => onSelect(table, check)}
      title={`${table.name} · ${STATE_LABEL[state]}`} aria-label={`${table.name}: ${STATE_LABEL[state]}`}
      className={`flex flex-col items-center justify-center border box-border overflow-hidden text-center ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${STATE_STYLE[state]} ${table.active ? interactive : 'opacity-40'} ${table.id === selectedId ? `${ring} z-10` : ''}`}>
      <span className="font-semibold leading-none text-[var(--text-main)] truncate max-w-full px-1" style={{ fontSize: Math.max(14, Math.min(cell * 0.5, 26)) }}>{table.name}</span>
      {check?.ready_items > 0 && (
        <span title={`${check.ready_items} ${check.ready_items === 1 ? 'pronto' : 'pronti'}`} className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-xs font-semibold leading-none flex items-center justify-center">{check.ready_items}</span>
      )}
      {cell * table.h >= 34 && (
        <span className="flex items-center gap-1 leading-none mt-1.5 font-medium text-[var(--text-muted)] tabular-nums" style={{ fontSize: Math.max(12, Math.min(cell * 0.36, 18)) }}>
          <Users size={Math.max(12, Math.min(cell * 0.34, 18))} aria-hidden="true" />{check ? check.covers : table.seats}
        </span>
      )}
      {!check && reservation && cell * table.h >= 56 && (
        <span className="leading-none mt-1 text-[var(--accent)] truncate max-w-full px-1" style={{ fontSize: Math.max(10, Math.min(cell * 0.26, 13)) }}>{reservation.start_time}</span>
      )}
    </button>
  );
};

// Le sale con i tavoli: un selettore in alto sceglie la sala, la pianta disegnata dall'admin occupa tutta l'area
// (scalata per starci intera) e mostra lo stato dal vivo. I tavoli non ancora piazzati restano schede sotto la pianta.
const FILTERS = [{ id: 'all', label: 'Tutti' }, { id: 'busy', label: 'Occupati' }, { id: 'ready', label: 'Pronti' }];

const FloorView = ({ rooms, checks, reserved = new Map(), service, selectedTableId, onSelect }) => {
  const phone = useIsMobile(640);                 // sul telefono i tavoli sono schede, non la pianta
  const [filter, setFilter] = useState('all');
  const byTable = new Map(checks.map(c => [c.table_id, c]));
  const checkOf = (t) => byTable.get(t.id);
  const activeRooms = rooms.filter(r => r.active);
  const [roomId, setRoomId] = useState(null);
  const room = activeRooms.find(r => r.id === roomId) ?? activeRooms[0];
  const covers = checks.reduce((s, c) => s + c.covers, 0);
  const openIn = (r) => r.tables.filter(t => byTable.has(t.id)).length;
  const loose = room ? room.tables.filter(t => !isPlaced(t)) : [];
  const shown = (room?.tables ?? []).filter(t => t.active && (filter === 'all' || (filter === 'busy' && byTable.has(t.id)) || (filter === 'ready' && byTable.get(t.id)?.ready_items > 0)));

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar" role="tablist" aria-label="Sale">
          {activeRooms.map(r => (
            <button key={r.id} role="tab" aria-selected={r.id === room.id} onClick={() => setRoomId(r.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${r.id === room.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
              {r.name}{openIn(r) > 0 && <span className={`ml-2 text-xs ${r.id === room.id ? 'text-white/80' : 'text-[var(--accent)]'}`}>{openIn(r)}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-[var(--text-muted)]">
          <span className={service ? 'text-green-500' : 'text-red-400'}>● {service ? service.name : 'Servizio chiuso'}</span>
          <span>{checks.length} {checks.length === 1 ? 'tavolo occupato' : 'tavoli occupati'}</span>
          <span>{covers} {covers === 1 ? 'coperto' : 'coperti'}</span>
        </div>
      </div>

      {!room && <p className="text-sm text-[var(--text-muted)]">Nessuna sala configurata. Un amministratore può crearle in Impostazioni.</p>}
      {phone && room && (
        <>
          <div className={`${segmentBox} shrink-0`} role="tablist" aria-label="Filtro tavoli">
            {FILTERS.map(f => <button key={f.id} role="tab" aria-selected={filter === f.id} className={segment(filter === f.id)} onClick={() => setFilter(f.id)}>{f.label}</button>)}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {shown.length === 0 && <p className="text-sm text-[var(--text-muted)] py-6 text-center">Nessun tavolo</p>}
            <div className="grid grid-cols-2 gap-2.5 pb-2">
              {shown.map(t => <TableCard key={t.id} table={t} check={checkOf(t)} reservation={reserved.get(t.id)} selected={t.id === selectedTableId} onSelect={onSelect} />)}
            </div>
          </div>
        </>
      )}
      {!phone && room && room.tables.some(isPlaced) && (
        <div className="flex-1 min-h-[200px]">
          <FloorCanvas fit gridW={room.grid_w} gridH={room.grid_h} tables={room.tables} elements={room.elements} renderTable={mapTable(checkOf, (t) => reserved.get(t.id), selectedTableId, onSelect)} />
        </div>
      )}
      {!phone && loose.length > 0 && (
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 shrink-0 max-h-[40%] overflow-y-auto no-scrollbar">
          {loose.map(t => <TableCard key={t.id} table={t} check={checkOf(t)} reservation={reserved.get(t.id)} selected={t.id === selectedTableId} onSelect={onSelect} />)}
        </div>
      )}
      {room && !room.tables.length && <p className="text-sm text-[var(--text-muted)]">Nessun tavolo in questa sala.</p>}
    </div>
  );
};

export default FloorView;
