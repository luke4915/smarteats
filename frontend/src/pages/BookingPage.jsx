import { useState, useEffect, useMemo, useRef } from 'react';
import { Minus, Plus, Phone, Check, CalendarDays, Clock, Users } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatDay } from '../smarteats/reservations/rules';
import { btnPrimary, btn, input } from '../smarteats/floor/ui';

// Pagina pubblica di prenotazione (`/book`): il cliente sceglie quanti siete, il giorno e il turno, lascia i suoi
// dati e invia una *richiesta*: il locale la conferma. `/book/<codice>` è la pagina di stato con l'annullo.
// Nessun accesso, nessun menu: pensata per il telefono. Le regole (posti, anticipo, tetti) le applica il server.

const STATUS_TEXT = {
  requested: { title: 'Richiesta ricevuta', body: 'Il locale la conferma a breve. Finché non è confermata non è ancora una prenotazione.' },
  confirmed: { title: 'Prenotazione confermata', body: 'Vi aspettiamo. Se cambiano i programmi, potete chiedere l\'annullo da qui fino a un\'ora prima del turno; dopo, chiamateci.' },
  declined: { title: 'Richiesta non accettata', body: 'Purtroppo non è stato possibile accettarla. Potete provare un altro giorno o chiamarci.' },
  cancelled: { title: 'Richiesta annullata', body: 'Il posto è stato liberato.' },
  expired: { title: 'Richiesta scaduta', body: 'Il locale non ha risposto in tempo e il posto è stato liberato. Potete inviarne una nuova o chiamarci.' },
  seated: { title: 'Siete al tavolo', body: 'Buon appetito!' },
  completed: { title: 'Grazie della visita', body: 'A presto!' },
  no_show: { title: 'Non vi abbiamo visti', body: 'Se è un errore, chiamateci.' },
};

const useSystemTheme = () => useEffect(() => {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', !!media?.matches);
  apply();
  media?.addEventListener?.('change', apply);
  return () => media?.removeEventListener?.('change', apply);
}, []);

const Shell = ({ info, children }) => (
  // Il body dell'app è bloccato (`overflow: hidden`): questa pagina scorre dentro il proprio contenitore.
  <div className="se-app fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--bg-main)] text-[var(--text-main)]" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
    <main className="max-w-md sm:max-w-3xl mx-auto px-4 pt-6 sm:pt-8 space-y-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      {info && (
        <header className="space-y-1">
          <p className="text-sm text-[var(--text-muted)]">Prenota un tavolo</p>
          <h1 className="text-2xl font-semibold tracking-tight">{info.name}</h1>
          {info.welcome && <p className="text-sm text-[var(--text-muted)] pt-1">{info.welcome}</p>}
        </header>
      )}
      {children}
      {info?.phone && (
        <p className="text-sm text-[var(--text-muted)] text-center pt-2">
          Preferite telefonare? <a className="inline-block py-2 text-[var(--accent)] font-medium" href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>{info.phone}</a>
        </p>
      )}
      <div aria-hidden="true" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </main>
  </div>
);

const Section = ({ n, title, children }) => (
  <section className="space-y-3">
    <h2 className="text-base font-semibold flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-sm flex items-center justify-center tabular-nums">{n}</span>{title}
    </h2>
    {children}
  </section>
);

// Pagina di stato di una richiesta, dal link personale
const Status = ({ token, info }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch(`/public/booking/requests/${token}`).then(setData).catch(err => setError(err.status === 404 ? 'Non troviamo questa richiesta: controllate il link.' : err.message));
  }, [token]);

  const cancel = async () => {
    setBusy(true); setError('');
    try { setData(await apiFetch(`/public/booking/requests/${token}/cancel`, { method: 'POST', body: {} })); setAsking(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (error && !data) return <p className="text-sm text-red-500" role="alert">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>;
  const text = STATUS_TEXT[data.status] ?? STATUS_TEXT.requested;
  const phone = data.restaurant.phone || info?.phone;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${data.status === 'confirmed' ? 'bg-green-500/15 text-green-500' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}><Check size={18} /></span>
          <h2 className="text-lg font-semibold">{text.title}</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{text.body}</p>
        {data.status === 'declined' && data.decline_reason && <p className="text-sm">«{data.decline_reason}»</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm pt-2 border-t border-[var(--border)]">
          <dt className="text-[var(--text-muted)]">Quando</dt><dd className="font-medium">{formatDay(data.date)} · {data.start_time}</dd>
          <dt className="text-[var(--text-muted)]">Persone</dt><dd className="font-medium">{data.party_size}</dd>
          <dt className="text-[var(--text-muted)]">A nome</dt><dd className="font-medium">{data.customer_name}</dd>
        </dl>
      </div>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      {data.cancel === 'withdraw' && (asking ? (
        <div className="rounded-xl border border-red-500/40 p-4 space-y-3">
          <p className="text-sm">Ritirare la richiesta? Il posto tornerà libero.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} onClick={() => setAsking(false)}>No, tienila</button>
            <button className="inline-flex items-center justify-center h-11 rounded-lg bg-red-500 text-white text-sm font-medium cursor-pointer disabled:opacity-50" disabled={busy} onClick={cancel}>Sì, ritira</button>
          </div>
        </div>
      ) : <button className={`${btn} w-full`} onClick={() => setAsking(true)}>Ritira la richiesta</button>)}
      {data.cancel === 'request' && (asking ? (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <p className="text-sm">La prenotazione è confermata: non si annulla da qui. Inviamo al locale la richiesta di annullo, e sarà il locale a confermarla.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} onClick={() => setAsking(false)}>Indietro</button>
            <button className={btnPrimary} disabled={busy} onClick={cancel}>Invia la richiesta</button>
          </div>
        </div>
      ) : <button className={`${btn} w-full`} onClick={() => setAsking(true)}>Chiedi di annullare</button>)}
      {data.cancel === 'requested' && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm" role="status">
          Hai chiesto di annullare. La prenotazione resta valida finché il locale non conferma: ti avviserà.
        </p>
      )}
      {data.cancel === 'call' && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm" role="status">
          Manca meno di un'ora al turno: per annullare o cambiare, chiama il locale.
        </p>
      )}
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={`${btn} w-full`}><Phone size={16} /> Chiama il locale</a>}
    </div>
  );
};

const BookingPage = () => {
  useSystemTheme();
  const token = window.location.pathname.split('/').filter(Boolean)[1] ?? null;   // /book/<codice>
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [party, setParty] = useState(2);
  const [days, setDays] = useState(null);
  const [date, setDate] = useState('');
  const [shifts, setShifts] = useState(null);
  const [shiftId, setShiftId] = useState(null);
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', notes: '', consent: false, website: '' });
  const [sending, setSending] = useState(false);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    apiFetch('/public/booking/info').then(setInfo).catch(err => setError(err.code === 'PORTAL_OFF' || err.status === 404 || err.status === 403
      ? 'Le prenotazioni online non sono attive. Per prenotare, chiamate direttamente il locale.' : err.message));
  }, []);

  // Il calendario si rilegge quando cambia il numero di persone: un giorno può non avere posto per sei ma sì per due
  useEffect(() => {
    if (!info || token) return;
    let cancelled = false;
    apiFetch(`/public/booking/calendar?party=${party}`).then(r => { if (!cancelled) setDays(r.days); }).catch(err => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [info, token, party]);

  useEffect(() => {
    if (!date) { setShifts(null); return; }
    let cancelled = false;
    setShiftId(null);
    apiFetch(`/public/booking/availability?date=${date}&party=${party}`).then(r => { if (!cancelled) setShifts(r.shifts); }).catch(err => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [date, party]);

  // Se cambiando persone il giorno scelto non è più disponibile, si ricomincia da lì
  useEffect(() => { if (date && days && !days.find(d => d.date === date)?.available) { setDate(''); } }, [days, date]);

  const shift = shifts?.find(s => s.id === shiftId);
  const valid = shift && form.customer_name.trim() && form.phone.replace(/\D/g, '').length >= 6 && form.consent;
  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true); setError('');
    try {
      const res = await apiFetch('/public/booking/requests', { method: 'POST', body: { date, shift_id: shiftId, party_size: party, ...form, opened_at: openedAt.current } });
      window.location.assign(`/book/${res.token}`);
    } catch (err) {
      setError(err.message);
      if (err.code === 'NO_CAPACITY') { setShiftId(null); apiFetch(`/public/booking/availability?date=${date}&party=${party}`).then(r => setShifts(r.shifts)).catch(() => {}); }
    } finally { setSending(false); }
  };

  const weekdays = useMemo(() => (days ?? []).map(d => ({ ...d, label: formatDay(d.date, { short: true }) })), [days]);

  if (error && !info) return <Shell><p className="text-sm text-[var(--text-muted)] text-center py-10" role="alert">{error}</p></Shell>;
  if (!info) return <Shell><p className="text-sm text-[var(--text-muted)]">Caricamento…</p></Shell>;
  if (token) return <Shell info={info}><Status token={token} info={info} /></Shell>;

  return (
    <Shell info={info}>
      <form className="space-y-7 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:items-start" onSubmit={send} noValidate>
        <div className="space-y-7">
        <Section n={1} title="Quanti siete?">
          <div className="flex items-center gap-4">
            <button type="button" className={`${btn} !w-12 !px-0`} aria-label="Una persona in meno" disabled={party <= 1} onClick={() => setParty(p => p - 1)}><Minus size={18} /></button>
            <span className="text-3xl font-semibold tabular-nums w-12 text-center" aria-live="polite">{party}</span>
            <button type="button" className={`${btn} !w-12 !px-0`} aria-label="Una persona in più" disabled={party >= info.max_party} onClick={() => setParty(p => p + 1)}><Plus size={18} /></button>
            <span className="text-sm text-[var(--text-muted)]"><Users size={14} className="inline mr-1" />{party === 1 ? 'persona' : 'persone'}</span>
          </div>
          {party >= info.max_party && <p className="text-sm text-[var(--text-muted)]">Per gruppi più grandi di {info.max_party} persone chiamateci{info.phone ? `: ${info.phone}` : ''}.</p>}
        </Section>

        <Section n={2} title="Che giorno?">
          {!days ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Giorno">
              {weekdays.map(d => (
                <button key={d.date} type="button" role="radio" aria-checked={date === d.date} disabled={!d.available} onClick={() => setDate(d.date)}
                  className={`h-14 rounded-lg border text-sm leading-tight cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${date === d.date ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
                  <span className="block capitalize">{d.label.split(' ').slice(0, 1)}</span>
                  <span className="block tabular-nums">{d.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          )}
          {days && !days.some(d => d.available) && <p className="text-sm text-[var(--text-muted)]">Per {party} {party === 1 ? 'persona' : 'persone'} non c'è disponibilità nei prossimi {info.max_days} giorni. Provate con meno persone o chiamateci.</p>}
        </Section>

        {date && (
          <Section n={3} title="A che ora?">
            {!shifts ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Turno">
                {shifts.map(s => (
                  <button key={s.id} type="button" role="radio" aria-checked={shiftId === s.id} disabled={!s.available} onClick={() => setShiftId(s.id)}
                    className={`h-14 rounded-lg border text-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${shiftId === s.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
                    <span className="block text-base tabular-nums"><Clock size={14} className="inline mr-1 -mt-0.5" />{s.start_time}</span>
                    <span className="block text-xs opacity-80">{s.available ? s.name : 'non disponibile'}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        </div>

        <div className="mt-7 sm:mt-0 space-y-7">
        {!shiftId && <p className="hidden sm:block text-sm text-[var(--text-muted)] rounded-xl border border-dashed border-[var(--border)] p-5">Scegliete giorno e ora: qui compaiono i campi per i vostri dati.</p>}
        {shiftId && (
          <Section n={4} title="I vostri dati">
            <div className="space-y-3">
              <label className="block"><span className="text-sm font-medium">Nome</span>
                <input className={`${input} !text-base !h-12 mt-1`} autoComplete="name" value={form.customer_name} onChange={setField('customer_name')} maxLength={80} required /></label>
              <label className="block"><span className="text-sm font-medium">Telefono</span>
                <input className={`${input} !text-base !h-12 mt-1`} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} maxLength={40} required /></label>
              <label className="block"><span className="text-sm font-medium">Email <span className="text-[var(--text-muted)] font-normal">(facoltativa)</span></span>
                <input className={`${input} !text-base !h-12 mt-1`} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={setField('email')} maxLength={120} /></label>
              <label className="block"><span className="text-sm font-medium">Note <span className="text-[var(--text-muted)] font-normal">(allergie, seggiolone…)</span></span>
                <textarea className={`${input} !text-base mt-1 !h-24 py-2`} value={form.notes} onChange={setField('notes')} maxLength={500} /></label>
              {/* Campo trappola: le persone non lo vedono */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Sito web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={setField('website')} /></label>
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--accent)]" checked={form.consent} onChange={setField('consent')} />
                <span className="text-[var(--text-muted)]">Acconsento al trattamento di nome, telefono ed email solo per gestire questa prenotazione. I dati si cancellano dopo 90 giorni.</span>
              </label>
            </div>

            <div className="rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] p-3 text-sm flex items-center gap-2">
              <CalendarDays size={16} className="text-[var(--accent)] shrink-0" />
              <span><b>{formatDay(date)}</b> · {shift?.start_time} · {party} {party === 1 ? 'persona' : 'persone'}</span>
            </div>
            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            {/* Il pulsante resta sempre a portata di pollice, anche scorrendo il modulo */}
            <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-[var(--bg-main)] border-t border-[var(--border)] space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button type="submit" className={`${btnPrimary} w-full !h-12 !text-base`} disabled={!valid || sending}>{sending ? 'Invio…' : 'Invia richiesta'}</button>
              <p className="text-xs text-[var(--text-muted)] text-center">Non è ancora una prenotazione: il locale la conferma a breve.</p>
            </div>
          </Section>
        )}
        </div>
        {error && !shiftId && <p className="text-sm text-red-500" role="alert">{error}</p>}
      </form>
    </Shell>
  );
};

export default BookingPage;
