import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { btn, btnPrimary, iconBtn, input, label } from './sala/ui';
import { formatDay } from './prenotazioni/rules';

const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Gio'], [5, 'Ven'], [6, 'Sab'], [0, 'Dom']];
const EMPTY = { name: '', start_time: '19:30', duration_minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 30, active: true };

// Turni fissi e chiusure delle prenotazioni (solo admin). La durata è quanto resta impegnato il tavolo: un tavolo si può
// prenotare per due turni di fila se il secondo comincia quando il primo è finito.
const BookingSettings = () => {
  const { showToast } = useToast();
  const [shifts, setShifts] = useState(null);
  const [closures, setClosures] = useState([]);
  const [draft, setDraft] = useState(null);
  const [closure, setClosure] = useState({ date_from: '', date_to: '', shift_id: '', reason: '' });

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([fetchWithAuth('/bookings/shifts'), fetchWithAuth('/bookings/closures')]);
      setShifts(s); setClosures(c);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const saveShift = async () => {
    try {
      const body = { name: draft.name.trim(), start_time: draft.start_time, duration_minutes: Number(draft.duration_minutes), weekdays: draft.weekdays, capacity: Number(draft.capacity), active: draft.active };
      await fetchWithAuth(draft.id ? `/bookings/shifts/${draft.id}` : '/bookings/shifts', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null); load();
    } catch (err) { showToast(err.message, 'error'); }
  };
  const removeShift = async (s) => {
    try { await fetchWithAuth(`/bookings/shifts/${s.id}`, { method: 'DELETE' }); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };
  const addClosure = async () => {
    try {
      await fetchWithAuth('/bookings/closures', { method: 'POST', body: { date_from: closure.date_from, date_to: closure.date_to || closure.date_from, shift_id: closure.shift_id ? Number(closure.shift_id) : null, reason: closure.reason } });
      setClosure({ date_from: '', date_to: '', shift_id: '', reason: '' }); load();
    } catch (err) { showToast(err.message, 'error'); }
  };
  const removeClosure = async (c) => {
    try { await fetchWithAuth(`/bookings/closures/${c.id}`, { method: 'DELETE' }); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };
  const toggleDay = (d) => setDraft(x => ({ ...x, weekdays: x.weekdays.includes(d) ? x.weekdays.filter(n => n !== d) : [...x.weekdays, d] }));

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Turni delle prenotazioni</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">Orari fissi in cui si accettano prenotazioni, con i coperti che si possono prenotare e quanto resta impegnato il tavolo.</p>
        {shifts === null ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
          <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg max-w-2xl mb-3">
            {shifts.length === 0 && <li className="px-3 py-3 text-sm text-[var(--text-muted)]">Nessun turno. Aggiungine uno, per esempio «Cena 19:30».</li>}
            {shifts.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => setDraft({ ...s })}>
                  <span className={`block text-sm font-medium ${s.active ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] line-through'}`}>{s.name}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{s.start_time} · {s.duration_minutes} min · {s.capacity} coperti · {DAYS.filter(([d]) => s.weekdays.includes(d)).map(([, n]) => n).join(' ')}</span>
                </button>
                <button className={`${iconBtn} hover:!text-red-500`} aria-label={`Elimina ${s.name}`} onClick={() => removeShift(s)}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="max-w-2xl space-y-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)]">
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2"><label className={label} htmlFor="s-name">Nome</label><input id="s-name" className={`${input} mt-1`} value={draft.name} maxLength={40} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Cena 19:30" /></div>
              <div><label className={label} htmlFor="s-time">Ora</label><input id="s-time" type="time" className={`${input} mt-1`} value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} /></div>
              <div><label className={label} htmlFor="s-cap">Coperti</label><input id="s-cap" type="number" min="1" max="999" className={`${input} mt-1`} value={draft.capacity} onChange={e => setDraft(d => ({ ...d, capacity: e.target.value }))} /></div>
            </div>
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div><label className={label} htmlFor="s-dur">Tavolo impegnato (minuti)</label><input id="s-dur" type="number" min="15" max="480" step="5" className={`${input} mt-1`} value={draft.duration_minutes} onChange={e => setDraft(d => ({ ...d, duration_minutes: e.target.value }))} /></div>
              <div className="sm:col-span-3">
                <p className={label}>Giorni</p>
                <div className="flex flex-wrap gap-1.5 mt-1" role="group" aria-label="Giorni">
                  {DAYS.map(([d, n]) => <button key={d} aria-pressed={draft.weekdays.includes(d)} onClick={() => toggleDay(d)}
                    className={`h-9 px-3 rounded-lg border text-sm font-medium cursor-pointer ${draft.weekdays.includes(d) ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>{n}</button>)}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer"><input type="checkbox" checked={draft.active} onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))} className="accent-[var(--accent)]" /> Attivo</label>
            <div className="flex gap-2"><button className={btnPrimary} disabled={!draft.name.trim() || !draft.weekdays.length} onClick={saveShift}>Salva turno</button><button className={btn} onClick={() => setDraft(null)}>Annulla</button></div>
          </div>
        ) : <button className={btn} onClick={() => setDraft({ ...EMPTY })}><Plus size={16} /> Nuovo turno</button>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Chiusure</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">Giorni in cui non si prenota: ferie, evento privato. Si può chiudere un solo turno.</p>
        <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg max-w-2xl mb-3">
          {closures.length === 0 && <li className="px-3 py-3 text-sm text-[var(--text-muted)]">Nessuna chiusura.</li>}
          {closures.map(c => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 min-w-0 text-sm text-[var(--text-main)]">
                {c.date_from === c.date_to ? formatDay(c.date_from, { short: true }) : `${formatDay(c.date_from, { short: true })} → ${formatDay(c.date_to, { short: true })}`}
                <span className="text-[var(--text-muted)]"> · {c.shift_id ? shifts?.find(s => s.id === c.shift_id)?.name : 'tutto il giorno'}{c.reason ? ` · ${c.reason}` : ''}</span>
              </span>
              <button className={`${iconBtn} hover:!text-red-500`} aria-label="Elimina la chiusura" onClick={() => removeClosure(c)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="max-w-2xl grid sm:grid-cols-5 gap-2 items-end">
          <div><label className={label} htmlFor="c-from">Dal</label><input id="c-from" type="date" className={`${input} mt-1`} value={closure.date_from} onChange={e => setClosure(c => ({ ...c, date_from: e.target.value }))} /></div>
          <div><label className={label} htmlFor="c-to">Al</label><input id="c-to" type="date" className={`${input} mt-1`} value={closure.date_to} onChange={e => setClosure(c => ({ ...c, date_to: e.target.value }))} /></div>
          <div><label className={label} htmlFor="c-shift">Turno</label>
            <select id="c-shift" className={`${input} mt-1`} value={closure.shift_id} onChange={e => setClosure(c => ({ ...c, shift_id: e.target.value }))}>
              <option value="">Tutto il giorno</option>{(shifts ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className={label} htmlFor="c-why">Motivo</label><input id="c-why" className={`${input} mt-1`} value={closure.reason} maxLength={200} onChange={e => setClosure(c => ({ ...c, reason: e.target.value }))} /></div>
          <button className={btn} disabled={!closure.date_from} onClick={addClosure}><Plus size={16} /> Aggiungi</button>
        </div>
      </section>
    </div>
  );
};

export default BookingSettings;
