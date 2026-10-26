import { useState } from 'react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { Users, Receipt, UserPlus, Clock } from 'lucide-react';
import FloorCanvas from '../floorplan/FloorCanvas';
import { isPlaced } from '../floorplan/geometry';
import { tableState } from './checkMath';
import { formatEuro, formatElapsed } from '../../utils/format';
import { minutesOf } from '../reservations/rules';
import Segmented from './Segmented';
import { tone, btn } from './ui';
import { seatsLabel } from './seats';
import ScrollRow from '../../components/shared/ScrollRow';

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const SOON_MINUTES = 60;           // una prenotazione entro l'ora colora già il tavolo

// Il nome dello stato non dipende dall'ora (un tavolo prenotato è «Libero» finché non si siedono): solo il colore avvisa.
const STATE_LABEL = { free: 'Libero', busy: 'Occupato', bill: 'Conto richiesto' };
const interactive = 'cursor-pointer hover:brightness-110 active:scale-[0.98] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';
const ring = 'ring-2 ring-offset-2 ring-offset-[var(--bg-card)] ring-[var(--text-main)]';

// Lo stato mostrato di un tavolo: i colori sono quelli della Timeline (floor/ui.js, `tone`).
const stateOf = (check, reservation) => {
  const state = tableState(check);
  if (state !== 'free' || !reservation) return state;
  const inMinutes = minutesOf(reservation.start_time) - nowMinutes();
  return inMinutes <= SOON_MINUTES ? 'reserved' : 'free';
};

// Scheda di un tavolo (telefono, e tavoli non ancora piazzati sulla pianta)
const TableCard = ({ table, check, reservation, selected, onSelect }) => {
  const state = stateOf(check, reservation);
  const label = STATE_LABEL[tableState(check)];
  return (
    <button disabled={!table.active} onClick={() => onSelect(table, check)} aria-label={`${table.name}: ${label}`}
      className={`text-left rounded-lg border p-3.5 min-h-[104px] flex flex-col justify-between ${tone[state]} ${table.active ? interactive : 'opacity-40'} ${selected ? ring : ''}`}>
      <div className="w-full">
        <span className="block text-2xl font-semibold leading-none text-[var(--text-main)]">{table.name}</span>
        <span className="mt-2 flex items-center gap-1.5 text-base font-medium tabular-nums text-[var(--text-muted)]"><Users size={16} aria-hidden="true" />{check ? check.covers : seatsLabel(table)}</span>
      </div>
      <div className="text-xs">
        <p className="font-semibold text-[var(--text-main)]">{table.active ? label : 'Non in uso'}</p>
        {check && <p className="mt-0.5 flex items-center gap-1.5 text-[var(--text-muted)] tabular-nums"><Receipt size={12} /> {formatEuro(check.total)} · {formatElapsed(minutesSince(check.opened_at))}</p>}
        {!check && reservation && <p className="mt-0.5 font-medium text-[var(--accent)] truncate">{reservation.start_time} · {reservation.customer_name} · {reservation.party_size}</p>}
        {check?.ready_items > 0 && <p className="mt-0.5 font-semibold text-[var(--accent)]">{check.ready_items} {check.ready_items === 1 ? 'pronto' : 'pronti'}</p>}
      </div>
    </button>
  );
};

// Un tavolo sulla pianta: forma e misura scelte dall'admin; colore, tempo e conto dallo stato dal vivo.
// Mentre si cerca un posto per chi arriva senza prenotazione (`walkIn`): i tavoli adatti hanno un anello azzurro, quello scelto
// è in evidenza, gli altri liberi restano normali e gli occupati si abbassano. Un tocco sceglie il tavolo.
const walkInClass = (walkIn, table) => {
  if (!walkIn) return '';
  if (!walkIn.free.includes(table.id)) return 'opacity-35';
  if (table.id === (walkIn.chosen ?? walkIn.suggested)) return 'ring-4 ring-[var(--accent)] z-10';
  return walkIn.fits.includes(table.id) ? 'ring-2 ring-[var(--accent)]/70' : '';
};

const mapTable = ({ checkOf, reservedOf, selectedId, onSelect, walkIn }) => (table, style, cell) => {
  const check = checkOf(table);
  const reservation = !check ? reservedOf(table) : null;
  const state = stateOf(check, reservation);
  const label = STATE_LABEL[tableState(check)];
  const height = cell * table.h;
  return (
    <button key={table.id} style={style} disabled={!table.active} onClick={() => onSelect(table, check)}
      title={`${table.name} · ${label}`} aria-label={`${table.name}: ${label}`}
      className={`flex flex-col items-center justify-center border-2 box-border overflow-hidden text-center ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'} ${tone[state]} ${table.active ? interactive : 'opacity-40'} ${walkIn ? walkInClass(walkIn, table) : (table.id === selectedId ? `${ring} z-10` : '')}`}>
      <span className="font-semibold leading-none text-[var(--text-main)] truncate max-w-full px-1" style={{ fontSize: Math.max(14, Math.min(cell * 0.5, 26)) }}>{table.name}</span>
      {check?.ready_items > 0 && (
        <span title={`${check.ready_items} ${check.ready_items === 1 ? 'pronto' : 'pronti'}`} className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-semibold leading-none flex items-center justify-center">{check.ready_items}</span>
      )}
      {height >= 34 && (
        <span className="flex items-center gap-1 leading-none mt-1.5 font-medium text-[var(--text-muted)] tabular-nums" style={{ fontSize: Math.max(12, Math.min(cell * 0.36, 18)) }}>
          <Users size={Math.max(12, Math.min(cell * 0.34, 18))} aria-hidden="true" />{check ? check.covers : seatsLabel(table)}
        </span>
      )}
      {check && height >= 76 && (
        <span className="leading-none mt-1.5 text-[var(--text-main)] tabular-nums truncate max-w-full px-1" style={{ fontSize: Math.max(11, Math.min(cell * 0.3, 15)) }}>{formatEuro(check.total)} · {formatElapsed(minutesSince(check.opened_at))}</span>
      )}
      {!check && reservation && height >= 56 && (
        <span className="leading-none mt-1.5 font-medium text-[var(--accent)] truncate max-w-full px-1" style={{ fontSize: Math.max(11, Math.min(cell * 0.3, 15)) }}>{reservation.start_time}</span>
      )}
    </button>
  );
};

// Le prossime prenotazioni confermate (una per prenotazione, anche se hanno più tavoli): un tocco apre la prenotazione.
const Arrivals = ({ reserved, onOpen }) => {
  const list = [...new Map([...reserved.values()].map(r => [r.id, r])).values()].sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time)).slice(0, 6);
  if (!list.length) return null;
  return (
    <ScrollRow className="shrink-0 flex items-center gap-2" aria-label="Prossimi arrivi">
      <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><Clock size={14} aria-hidden="true" /> In arrivo</span>
      {list.map(r => (
        <button key={r.id} onClick={() => onOpen(r)} className={`${btn} !h-9 !px-3 shrink-0 text-xs`}>
          <span className="tabular-nums text-[var(--accent)]">{r.start_time}</span>{r.customer_name}
          <span className="flex items-center gap-1 text-[var(--text-muted)] tabular-nums"><Users size={12} aria-hidden="true" />{r.party_size}</span>
        </button>
      ))}
    </ScrollRow>
  );
};

// Le sale con i tavoli: la pianta disegnata dall'admin occupa tutta l'area (scalata per starci intera) e mostra lo stato dal
// vivo. Il selettore delle sale compare solo se sono più di una; lo stato si legge dai colori e dai numeri sul tavolo, senza filtri. I tavoli non ancora piazzati restano schede sotto la pianta.
const FloorView = ({ rooms, checks, reserved = new Map(), selectedTableId, onSelect, onWalkIn, onOpenReservation, reserve = 0, walkIn = null }) => {
  const phone = useIsMobile(640);                 // sul telefono i tavoli sono schede, non la pianta
  const [roomId, setRoomId] = useState(null);
  const byTable = new Map(checks.map(c => [c.table_id, c]));
  const checkOf = (t) => byTable.get(t.id);
  const activeRooms = rooms.filter(r => r.active);
  const room = activeRooms.find(r => r.id === roomId) ?? activeRooms[0];
  const covers = checks.reduce((s, c) => s + c.covers, 0);
  const openIn = (r) => r.tables.filter(t => byTable.has(t.id)).length;
  const loose = room ? room.tables.filter(t => !isPlaced(t)) : [];
  const shown = (room?.tables ?? []).filter(t => t.active);
  const aside = { paddingRight: reserve };        // con il pannello aperto l'intestazione e il resto si fanno da parte

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div style={aside} className="flex items-center justify-between gap-3 shrink-0 transition-[padding] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]">
        <div className="flex items-center gap-3 min-w-0">
          {activeRooms.length > 1 && <Segmented label="Sale" scroll className="shrink-0 max-w-full" value={room.id} onChange={setRoomId}
            options={activeRooms.map(r => ({ id: r.id, label: <>{r.name}{openIn(r) > 0 && <span className="ml-2 text-xs text-[var(--accent)]">{openIn(r)}</span>}</> }))} />}
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-[var(--text-muted)] min-w-0">
          <span className="tabular-nums whitespace-nowrap truncate min-w-0">{checks.length} {checks.length === 1 ? 'occupato' : 'occupati'} · {covers} {covers === 1 ? 'coperto' : 'coperti'}</span>
          {onWalkIn && <button onClick={onWalkIn} className={`${btn} !h-9 shrink-0`}><UserPlus size={15} /> Walk-in</button>}
        </div>
      </div>

      {!room && <p className="text-sm text-[var(--text-muted)]">Nessuna sala configurata. Un amministratore può crearle in Impostazioni.</p>}
      {phone && room && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {shown.length === 0 && <p className="text-sm text-[var(--text-muted)] py-6 text-center">Nessun tavolo</p>}
          <div className="grid grid-cols-2 gap-2.5 pb-2">
            {shown.map(t => <TableCard key={t.id} table={t} check={checkOf(t)} reservation={reserved.get(t.id)} selected={t.id === selectedTableId} onSelect={onSelect} />)}
          </div>
        </div>
      )}
      {!phone && room && room.tables.some(isPlaced) && (
        <div className="flex-1 min-h-[200px]">
          <FloorCanvas fit reserve={reserve} focusTable={walkIn ? null : room.tables.find(t => t.id === selectedTableId)} gridW={room.grid_w} gridH={room.grid_h} tables={room.tables} elements={room.elements}
            renderTable={mapTable({ checkOf, reservedOf: (t) => reserved.get(t.id), selectedId: selectedTableId, onSelect, walkIn })} />
        </div>
      )}
      {!phone && loose.length > 0 && (
        <div style={aside} className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 shrink-0 max-h-[40%] overflow-y-auto no-scrollbar transition-[padding] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]">
          {loose.map(t => <TableCard key={t.id} table={t} check={checkOf(t)} reservation={reserved.get(t.id)} selected={t.id === selectedTableId} onSelect={onSelect} />)}
        </div>
      )}
      {room && !room.tables.length && <p className="text-sm text-[var(--text-muted)]">Nessun tavolo in questa sala.</p>}
      {onOpenReservation && <div style={aside} className="shrink-0 transition-[padding] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"><Arrivals reserved={reserved} onOpen={onOpenReservation} /></div>}
    </div>
  );
};

export default FloorView;
