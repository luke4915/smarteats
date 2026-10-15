import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarX } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { useBookings } from './useBookings';
import { todayLocal, addDays, formatDay, agendaGroups } from './rules';
import ReservationPanel from './ReservationPanel';
import ReservationForm from './ReservationForm';
import TablePicker from './TablePicker';
import StatusChip from './StatusChip';
import { btnPrimary, iconBtn, btn } from '../floor/ui';

const card = 'bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 sm:p-5 min-w-0';

const Empty = () => (
  <div className="h-full flex flex-col items-center justify-center gap-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-[var(--text-muted)] opacity-60">
    <CalendarX size={32} />
    <p className="text-sm text-center">Scegli una prenotazione</p>
  </div>
);

// L'agenda delle prenotazioni: una giornata alla volta, divisa per turno e per cosa serve fare. Come la Sala: a sinistra
// l'elenco, a destra un solo pannello che cambia (dettaglio, nuova, tavoli); su schermo stretto il pannello è a tutto schermo.
const ReservationsPage = ({ event }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useIsMobile(900);
  const [date, setDate] = useState(() => location.state?.date ?? todayLocal());
  const { shifts, rooms, reservations, availability, loading, reload } = useBookings(date, event);
  const [panel, setPanel] = useState(null);     // { kind: 'detail' | 'new' | 'edit' | 'tables', id? }

  const byId = useMemo(() => new Map(reservations.map(r => [r.id, r])), [reservations]);
  const tableNames = useMemo(() => { const m = new Map(rooms.flatMap(r => r.tables).map(t => [t.id, t.name])); return (ids) => ids.map(id => m.get(id)).filter(Boolean); }, [rooms]);
  // Si arriva dalla campanella: si apre il giorno e la prenotazione da decidere, poi lo stato di navigazione si butta
  useEffect(() => {
    const target = location.state;
    if (!target?.reservationId) return;
    if (target.date) setDate(target.date);
    setPanel({ kind: 'detail', id: target.reservationId });
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const current = panel?.id ? byId.get(panel.id) : null;
  const activeShifts = shifts.filter(s => s.active);
  const total = reservations.filter(r => ['requested', 'confirmed', 'seated'].includes(r.status)).reduce((s, r) => s + r.party_size, 0);
  const pending = reservations.filter(r => r.status === 'requested').length;
  const go = (n) => { setDate(d => addDays(d, n)); setPanel(null); };
  const close = () => setPanel(null);
  const saved = async (res) => { await reload(); setPanel({ kind: 'detail', id: res.id }); };

  const list = (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-wrap items-center gap-3 pb-3 shrink-0">
        <div className="flex items-center gap-1">
          <button className={iconBtn} aria-label="Giorno precedente" onClick={() => go(-1)}><ChevronLeft size={20} /></button>
          <div className="min-w-[10.5rem] text-center">
            <p className="text-lg font-semibold tracking-tight text-[var(--text-main)] first-letter:uppercase leading-tight">{formatDay(date)}</p>
            <p className="text-xs text-[var(--text-muted)]">{total} {total === 1 ? 'persona' : 'persone'}{pending > 0 && <span className="text-amber-500"> · {pending} da confermare</span>}</p>
          </div>
          <button className={iconBtn} aria-label="Giorno successivo" onClick={() => go(1)}><ChevronRight size={20} /></button>
        </div>
        <input type="date" aria-label="Vai al giorno" value={date} onChange={e => e.target.value && (setDate(e.target.value), setPanel(null))}
          className="h-10 px-2 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-sm text-[var(--text-main)]" />
        {date !== todayLocal() && <button className={`${btn} !h-10`} onClick={() => { setDate(todayLocal()); setPanel(null); }}>Oggi</button>}
        <button className={`${btnPrimary} !h-10 ml-auto`} disabled={!activeShifts.length} onClick={() => setPanel({ kind: 'new' })}><Plus size={16} /> Nuova</button>
      </header>

      {activeShifts.length === 0 && !loading && (
        <p className="text-sm text-[var(--text-muted)] py-6">Non ci sono turni attivi. Creali in <button className="text-[var(--accent)] font-medium cursor-pointer" onClick={() => navigate('/settings')}>Impostazioni</button>.</p>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1">
        {loading && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
        {!loading && activeShifts.map(shift => {
          const a = availability.find(x => x.shift_id === shift.id);
          const mine = reservations.filter(r => r.shift_id === shift.id);
          const groups = agendaGroups(mine);
          const pct = a ? Math.min(100, Math.round((a.held / a.capacity) * 100)) : 0;
          return (
            <section key={shift.id} aria-label={shift.name}>
              <div className="flex items-end justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-main)]">{shift.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{a && !a.bookable && a.reason && a.reason !== 'Al completo' ? a.reason : `${shift.start_time} · tavolo per ${shift.duration_minutes} min`}</p>
                </div>
                {a && (
                  <div className="text-right shrink-0 w-36">
                    <p className={`text-xs tabular-nums ${a.over > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{a.held} / {a.capacity} coperti{a.over > 0 ? ` (+${a.over})` : ''}</p>
                    <div className="h-1.5 rounded-full bg-[var(--bg-card-2)] mt-1 overflow-hidden"><div className={`h-full rounded-full ${a.over > 0 ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
              </div>
              {groups.length === 0 && <p className="text-sm text-[var(--text-muted)] py-3 border-t border-[var(--border)]">Nessuna prenotazione.</p>}
              {groups.map(g => (
                <div key={g.key} className="mb-3">
                  <p className={`text-xs font-medium mb-1.5 ${g.key === 'requested' ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{g.title} · {g.items.length}</p>
                  <ul className="space-y-1.5">
                    {g.items.map(r => (
                      <li key={r.id}>
                        <button onClick={() => setPanel({ kind: 'detail', id: r.id })} aria-label={`${r.customer_name}, ${r.party_size} persone`}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition cursor-pointer ${panel?.id === r.id ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--bg-card-2)] hover:border-[var(--border-hover)]'} ${g.key === 'closed' ? 'opacity-60' : ''}`}>
                          <span className="w-9 text-center text-sm font-semibold tabular-nums text-[var(--text-main)]">{r.party_size}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-[var(--text-main)] truncate">{r.customer_name}</span>
                            <span className="block text-xs text-[var(--text-muted)] truncate">{[tableNames(r.table_ids).join(', ') || 'senza tavolo', r.notes].filter(Boolean).join(' · ')}</span>
                          </span>
                          {r.cancel_requested_at && r.status === 'confirmed'
                            ? <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-red-500/15 text-red-500">Chiede di annullare</span>
                            : <StatusChip status={r.status} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );

  const side = !panel ? <Empty />
    : panel.kind === 'new' ? <ReservationForm date={date} shifts={shifts} availability={availability} onBack={close} onSaved={saved} />
    : !current ? <Empty />
    : panel.kind === 'edit' ? <ReservationForm date={date} shifts={shifts} availability={availability} reservation={current} onBack={() => setPanel({ kind: 'detail', id: current.id })} onSaved={saved} />
    : panel.kind === 'tables' ? <TablePicker reservation={current} rooms={rooms} all={reservations} onBack={() => setPanel({ kind: 'detail', id: current.id })} onSaved={saved} />
    : <ReservationPanel key={current.id + current.status} reservation={current} tableNames={tableNames} onBack={close}
        onChanged={async () => { await reload(); }}
        onTables={() => setPanel({ kind: 'tables', id: current.id })} onEdit={() => setPanel({ kind: 'edit', id: current.id })}
        onOpenCheck={() => navigate('/floor', { state: { tableId: current.table_ids[0] ?? null, checkId: current.check_id } })} />;

  if (!narrow) {
    return (
      <>
        <div className={`${card} flex-1 min-h-0 overflow-hidden`}>{list}</div>
        <div className="w-[380px] xl:w-[420px] shrink-0 h-full">{side}</div>
      </>
    );
  }
  return (
    <>
      <div className={`${card} flex-1 min-h-0 overflow-hidden`}>{list}</div>
      {panel && (
        <div className="fixed inset-0 z-[1700] bg-[var(--bg-main)] p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{side}</div>
      )}
    </>
  );
};

export default ReservationsPage;
