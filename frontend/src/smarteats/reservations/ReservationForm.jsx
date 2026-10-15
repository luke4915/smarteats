import { useState } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import CoversStepper from '../floor/CoversStepper';
import { btnPrimary, btn, input, label } from '../floor/ui';
import { formatDay } from './rules';

// Nuova prenotazione a mano (telefonata, di persona) o modifica di una esistente. Nasce confermata. Se il turno non ha
// posti il server lo dice e qui si può accettare comunque, di proposito.
const ReservationForm = ({ date, shifts, availability, reservation = null, defaultShiftId, onBack, onSaved }) => {
  const { showToast } = useToast();
  const editing = reservation !== null;
  const [shiftId, setShiftId] = useState(reservation?.shift_id ?? defaultShiftId ?? shifts.find(s => s.active)?.id ?? '');
  const [party, setParty] = useState(reservation?.party_size ?? 2);
  const [name, setName] = useState(reservation?.customer_name ?? '');
  const [phone, setPhone] = useState(reservation?.phone ?? '');
  const [email, setEmail] = useState(reservation?.email ?? '');
  const [notes, setNotes] = useState(reservation?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [overbook, setOverbook] = useState(null);     // messaggio del server quando i posti non bastano

  const free = (id) => availability.find(a => a.shift_id === id);
  const valid = name.trim() && shiftId && party >= 1;

  const save = async (ignoreCapacity = false) => {
    setBusy(true);
    try {
      const body = { shift_id: Number(shiftId), party_size: party, customer_name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim(), ignore_capacity: ignoreCapacity };
      const res = editing
        ? await fetchWithAuth(`/bookings/reservations/${reservation.id}`, { method: 'PUT', body })
        : await fetchWithAuth('/bookings/reservations', { method: 'POST', body: { ...body, date } });
      showToast(editing ? 'Prenotazione aggiornata' : 'Prenotazione salvata', 'success');
      onSaved(res);
    } catch (err) {
      if (err.code === 'NO_CAPACITY') setOverbook(err.message);
      else showToast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <PanelFrame title={editing ? 'Modifica prenotazione' : 'Nuova prenotazione'} subtitle={formatDay(date)} onBack={onBack}
      footer={
        overbook ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-500">{overbook}. Vuoi accettarla comunque?</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={btn} onClick={() => setOverbook(null)}>No</button>
              <button className={btnPrimary} disabled={busy} onClick={() => save(true)}>Accetta comunque</button>
            </div>
          </div>
        ) : <button className={`${btnPrimary} w-full !h-12`} disabled={!valid || busy} onClick={() => save(false)}>{busy ? 'Salvataggio…' : 'Salva'}</button>
      }>
      <div className="space-y-4 px-1 pb-2">
        <div>
          <p className={label}>Turno</p>
          <div className="mt-1.5 grid gap-1.5">
            {shifts.filter(s => s.active).map(s => {
              const a = free(s.id);
              const on = Number(shiftId) === s.id;
              return (
                <button key={s.id} aria-pressed={on} onClick={() => setShiftId(s.id)}
                  className={`flex items-center justify-between h-11 px-3 rounded-lg border text-sm transition cursor-pointer ${on ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)]'}`}>
                  <span className="font-medium text-[var(--text-main)]">{s.name}</span>
                  <span className={`text-xs ${a && !a.bookable ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{a ? (a.bookable ? `${a.free} posti liberi` : a.reason) : ''}</span>
                </button>
              );
            })}
            {shifts.every(s => !s.active) && <p className="text-sm text-[var(--text-muted)]">Nessun turno attivo: creane uno in Impostazioni → Prenotazioni.</p>}
          </div>
        </div>
        <div><p className={`${label} text-center`}>Persone</p><CoversStepper value={party} onChange={setParty} compact /></div>
        <div><label className={label} htmlFor="r-name">Nome</label><input id="r-name" className={`${input} mt-1`} value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Es. Rossi" autoFocus={!editing} /></div>
        <div><label className={label} htmlFor="r-phone">Telefono</label><input id="r-phone" className={`${input} mt-1`} inputMode="tel" value={phone} maxLength={40} onChange={e => setPhone(e.target.value)} /></div>
        <div><label className={label} htmlFor="r-email">Email (facoltativa)</label><input id="r-email" className={`${input} mt-1`} inputMode="email" value={email} maxLength={120} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className={label} htmlFor="r-notes">Note</label><input id="r-notes" className={`${input} mt-1`} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="Allergie, seggiolone, occasione…" /></div>
      </div>
    </PanelFrame>
  );
};

export default ReservationForm;
