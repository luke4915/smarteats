import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { formatDay } from './rules';
import { monthGrid, summaryByDay, dayLoad, busiestAndQuietest, heat } from './calendar';

const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

// Il mese come mappa di calore: più un giorno è pieno (persone prenotate su posti dei turni), più il riquadro è colorato.
// Dentro, una riga per turno con la sua barra e «prenotati / posti». Sopra, il giorno più carico e il più libero.
// Un tocco sul giorno apre la sua Timeline. I numeri arrivano da `GET /bookings/summary` (solo conteggi).
const MonthView = ({ month, shifts, today, event, selectedDate, onPickDay }) => {
  const { showToast } = useToast();
  const weeks = monthGrid(month);
  const [from, to] = [weeks[0][0].date, weeks.at(-1)[6].date];
  const key = `${from}/${to}`;
  const [data, setData] = useState({ key: null, byDay: new Map() });
  const [tick, setTick] = useState(0);
  useEffect(() => { if (event?.type === 'reservation_updated') setTick(t => t + 1); }, [event]);
  useEffect(() => {
    let live = true;
    fetchWithAuth(`/bookings/summary?from=${from}&to=${to}`)
      .then(rows => { if (live) setData({ key, byDay: summaryByDay(rows) }); })
      .catch(err => showToast(err.message || 'Errore caricamento calendario', 'error'));
    return () => { live = false; };
  }, [from, to, key, tick, showToast]);

  const days = useMemo(() => weeks.flat().map(d => ({ ...d, load: dayLoad(d.date, shifts, data.byDay.get(d.date)) })), [weeks, shifts, data.byDay]);
  const { busiest, quietest } = busiestAndQuietest(days.filter(d => d.inMonth));
  const loading = data.key !== key;
  const describe = (d) => `${formatDay(d.date, { short: true })} · ${d.load.pct}%`;

  return (
    <div className={`flex-1 min-h-0 flex flex-col gap-3 ${loading ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-muted)] shrink-0">
        {busiest && <span>Più carico: <strong className="font-medium text-[var(--text-main)]">{describe(busiest)}</strong></span>}
        {quietest && <span>Più libero: <strong className="font-medium text-[var(--text-main)]">{describe(quietest)}</strong></span>}
        <span className="ml-auto flex items-center gap-2 text-xs" aria-hidden="true">
          Libero
          <i className="w-24 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 60%, transparent))', border: '1px solid var(--border)' }} />
          Pieno
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]" role="region" aria-label="Calendario del mese">
        <div className="grid grid-cols-7 sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border)]">
          {WEEKDAYS.map(d => <div key={d} className="px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr min-h-[calc(100%-2rem)]">
          {days.map(({ date, inMonth, day, load }) => (
            <button key={date} onClick={() => onPickDay(date)}
              aria-label={`${date}${load.pct === null ? ', nessun turno' : `, ${load.covers} persone, ${load.pct}% pieno`}`}
              style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${heat(load.pct) * 100}%, transparent)` }}
              className={`min-h-[92px] p-1.5 border-b border-r border-[var(--border)] text-left flex flex-col gap-1 cursor-pointer hover:brightness-110 transition ${inMonth ? '' : 'opacity-35'} ${date === selectedDate ? 'ring-2 ring-inset ring-[var(--text-main)]' : ''}`}>
              <span className="flex items-center justify-between gap-1">
                {load.requested > 0 ? <span className="text-[11px] font-medium text-amber-500">{load.requested} da confermare</span> : <span />}
                <span className={`text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full ${date === today ? 'bg-[var(--accent)] text-white font-semibold' : 'text-[var(--text-muted)]'}`}>{day}</span>
              </span>
              {load.perShift.filter(p => p.covers > 0).map(p => (
                <span key={p.shift.id} className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-main)]" title={`${p.shift.name}: ${p.reservations} prenotazioni, ${p.covers} persone su ${p.shift.capacity} posti`}>
                  <span className="w-9 shrink-0 text-[var(--text-muted)]">{p.shift.start_time}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-[var(--text-main)]/10 overflow-hidden"><i className={`block h-full rounded-full ${p.pct > 100 ? 'bg-red-500' : p.pct >= 85 ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} style={{ width: `${Math.min(p.pct, 100)}%` }} /></span>
                  <span className={`w-12 text-right ${p.pct > 100 ? 'text-red-500' : ''}`}>{p.covers}/{p.shift.capacity}</span>
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthView;
