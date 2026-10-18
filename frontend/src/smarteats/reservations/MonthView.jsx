import { useEffect, useState } from 'react';
import { Users, CalendarCheck } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { monthGrid, summaryByDay } from './calendar';

const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
// Un colore per turno, nell'ordine dei turni: il pranzo e la cena si distinguono a colpo d'occhio
const TONES = ['bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', 'bg-amber-500/20 text-amber-600 dark:text-amber-400', 'bg-sky-500/20 text-sky-600 dark:text-sky-400', 'bg-violet-500/20 text-violet-600 dark:text-violet-400'];

// Il mese a colpo d'occhio: per ogni giorno una riga per turno con prenotazioni e coperti. Un tocco sul giorno apre la
// sua Timeline. Si legge da `GET /bookings/summary` (solo numeri); si aggiorna quando cambia una prenotazione.
const MonthView = ({ month, shifts, today, event, selectedDate, onPickDay }) => {
  const { showToast } = useToast();
  const weeks = monthGrid(month);
  const [from, to] = [weeks[0][0].date, weeks.at(-1)[6].date];
  const [data, setData] = useState({ key: null, byDay: new Map() });
  const key = `${from}/${to}`;
  const [tick, setTick] = useState(0);
  useEffect(() => { if (event?.type === 'reservation_updated') setTick(t => t + 1); }, [event]);
  useEffect(() => {
    let live = true;
    fetchWithAuth(`/bookings/summary?from=${from}&to=${to}`)
      .then(rows => { if (live) setData({ key, byDay: summaryByDay(rows) }); })
      .catch(err => showToast(err.message || 'Errore caricamento calendario', 'error'));
    return () => { live = false; };
  }, [from, to, key, tick, showToast]);

  const order = shifts.filter(s => s.active).map(s => s.id);
  const loading = data.key !== key;

  return (
    <div className={`flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] ${loading ? 'opacity-60' : ''}`} role="region" aria-label="Calendario del mese">
      <div className="grid grid-cols-7 sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border)]">
        {WEEKDAYS.map(d => <div key={d} className="px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr min-h-[calc(100%-2rem)]">
        {weeks.flat().map(({ date, inMonth, day }) => {
          const rows = data.byDay.get(date) ?? {};
          const items = order.filter(id => rows[id]);
          return (
            <button key={date} onClick={() => onPickDay(date)} aria-label={`${date}${items.length ? `, ${items.reduce((n, id) => n + rows[id].covers, 0)} persone` : ''}`}
              className={`min-h-[84px] p-1.5 border-b border-r border-[var(--border)] text-left flex flex-col gap-1 cursor-pointer hover:bg-[var(--bg-card-2)] transition-colors ${inMonth ? '' : 'opacity-40'} ${date === selectedDate ? 'bg-[var(--accent)]/5' : ''}`}>
              <span className={`text-xs tabular-nums self-end w-6 h-6 flex items-center justify-center rounded-full ${date === today ? 'bg-[var(--accent)] text-white font-semibold' : 'text-[var(--text-muted)]'}`}>{day}</span>
              {items.map(id => {
                const r = rows[id];
                return (
                  <span key={id} className={`flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${TONES[order.indexOf(id) % TONES.length]}`}
                    title={`${shifts.find(s => s.id === id)?.name}: ${r.reservations} prenotazioni, ${r.covers} persone${r.requested ? `, ${r.requested} da confermare` : ''}`}>
                    <span className="flex items-center gap-1"><CalendarCheck size={11} aria-hidden="true" />{r.reservations}</span>
                    <span className="flex items-center gap-1"><Users size={11} aria-hidden="true" />{r.covers}</span>
                    {r.requested > 0 && <i className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="Da confermare" />}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
