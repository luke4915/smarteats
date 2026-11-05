import { useState, useEffect, useMemo, useRef } from 'react';
import { Minus, Plus, Phone, CalendarDays, Clock, Users } from 'lucide-react';
import StatusMark from '../components/public/StatusMark';
import { apiFetch } from '../utils/apiClient';
import { formatDay } from '../modules/bookings/rules';
import { btnPrimary, btn, input } from '../components/shared/styles';
import { PublicShell, StepSection } from '../components/public/PublicShell';
import StepProgress from '../components/public/StepProgress';
import Loading from '../components/shared/Loading';
import { useT, useEffectiveLanguage } from '../i18n/useLanguage';

// Pagina pubblica di prenotazione (`/book`): il cliente sceglie quanti siete, il giorno e il turno, lascia i suoi
// dati e invia una *richiesta*: il locale la conferma. `/book/<codice>` è la pagina di stato con l'annullo.
// Nessun accesso, nessun menu: pensata per il telefono. Le regole (posti, anticipo, tetti) le applica il server.

const STATUS_KEYS = ['requested', 'confirmed', 'declined', 'cancelled', 'expired', 'seated', 'completed', 'no_show'];

// Tradotta in italiano e inglese; chi ha scelto un'altra lingua legge l'inglese
const Shell = ({ info, children }) => {
  const t = useT();
  return <PublicShell translated={['it', 'en']} info={info} kicker={t('bk.kicker')}>{children}</PublicShell>;
};
const Section = StepSection;

// Come si presenta l'esito: spunta se va bene, X se non è andato a buon fine, orologio in attesa del locale.
const TONE = { requested: 'waiting', confirmed: 'good', seated: 'good', completed: 'good', declined: 'bad', cancelled: 'bad', expired: 'bad', no_show: 'bad' };

// Pagina di stato di una richiesta, dal link personale
const Status = ({ token, info }) => {
  const t = useT();
  const lang = useEffectiveLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch(`/public/booking/requests/${token}`).then(setData).catch(err => setError(err.status === 404 ? t('bk.notFound') : err.message));
  }, [token, t]);

  const cancel = async () => {
    setBusy(true); setError('');
    try { setData(await apiFetch(`/public/booking/requests/${token}/cancel`, { method: 'POST', body: {} })); setAsking(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (error && !data) return <p className="text-sm text-red-500" role="alert">{error}</p>;
  if (!data) return <Loading />;
  const key = STATUS_KEYS.includes(data.status) ? data.status : 'requested';
  const text = { title: t(`bk.status.${key}.title`), body: t(`bk.status.${key}.body`) };
  const phone = data.restaurant.phone || info?.phone;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StatusMark tone={TONE[data.status]} />
          <h2 className="text-lg font-semibold">{text.title}</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{text.body}</p>
        {data.status === 'declined' && data.decline_reason && <p className="text-sm">«{data.decline_reason}»</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm pt-2 border-t border-[var(--border)]">
          <dt className="text-[var(--text-muted)]">{t('pub.when')}</dt><dd className="font-medium">{formatDay(data.date, { lang })} · {data.start_time}</dd>
          <dt className="text-[var(--text-muted)]">{t('pub.people')}</dt><dd className="font-medium">{data.party_size}</dd>
          <dt className="text-[var(--text-muted)]">{t('pub.underName')}</dt><dd className="font-medium">{data.customer_name}</dd>
        </dl>
      </div>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      {data.cancel === 'withdraw' && (asking ? (
        <div className="rounded-xl border border-red-500/40 p-4 space-y-3">
          <p className="text-sm">{t('bk.withdrawAsk')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} onClick={() => setAsking(false)}>{t('pub.keep')}</button>
            <button className="inline-flex items-center justify-center h-11 rounded-lg bg-red-500 text-white text-sm font-medium cursor-pointer disabled:opacity-50" disabled={busy} onClick={cancel}>{t('pub.yesWithdraw')}</button>
          </div>
        </div>
      ) : <button className={`${btn} w-full`} onClick={() => setAsking(true)}>{t('pub.withdraw')}</button>)}
      {data.cancel === 'request' && (asking ? (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <p className="text-sm">{t('bk.confirmedAsk')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} onClick={() => setAsking(false)}>{t('pub.back')}</button>
            <button className={btnPrimary} disabled={busy} onClick={cancel}>{t('bk.sendRequest')}</button>
          </div>
        </div>
      ) : <button className={`${btn} w-full`} onClick={() => setAsking(true)}>{t('bk.askCancel')}</button>)}
      {data.cancel === 'requested' && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm" role="status">
          {t('bk.cancelRequested')}
        </p>
      )}
      {data.cancel === 'call' && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm" role="status">
          {t('bk.cancelCall')}
        </p>
      )}
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={`${btn} w-full`}><Phone size={16} /> {t('pub.callVenue')}</a>}
    </div>
  );
};

const BookingPage = () => {
  const t = useT();
  const lang = useEffectiveLanguage();
  const token = window.location.pathname.split('/').filter(Boolean)[1] ?? null;   // /book/<codice>
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [party, setParty] = useState(2);
  const [partyTouched, setPartyTouched] = useState(false);   // 2 persone è solo il valore di partenza: il passo si completa quando lo si conferma o si va avanti
  const [days, setDays] = useState(null);
  const [date, setDate] = useState('');
  const [shifts, setShifts] = useState(null);
  const [shiftId, setShiftId] = useState(null);
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', notes: '', consent: false, marketing: false, website: '' });
  const [sending, setSending] = useState(false);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    apiFetch('/public/booking/info').then(setInfo).catch(err => setError(err.code === 'PORTAL_OFF' || err.status === 404 || err.status === 403
      ? t('bk.off') : err.message));
  }, [t]);

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
  const detailsDone = !!form.customer_name.trim() && form.phone.replace(/\D/g, '').length >= 6 && form.consent;
  const valid = shift && detailsDone;
  // I pallini in cima si riempiono mentre si compila
  const steps = [
    { id: 'party', label: t('bk.step.party'), done: partyTouched || !!date },
    { id: 'day', label: t('bk.step.day'), done: !!date },
    { id: 'time', label: t('bk.step.time'), done: !!shiftId },
    { id: 'details', label: t('bk.step.details'), done: !!shiftId && detailsDone },
  ];
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

  const weekdays = useMemo(() => (days ?? []).map(d => ({ ...d, label: formatDay(d.date, { short: true, lang }) })), [days, lang]);

  if (error && !info) return <Shell><p className="text-sm text-[var(--text-muted)] text-center py-10" role="alert">{error}</p></Shell>;
  if (!info) return <Shell><Loading /></Shell>;
  if (token) return <Shell info={info}><Status token={token} info={info} /></Shell>;

  return (
    <Shell info={info}>
      <StepProgress steps={steps} />
      <form className="space-y-7 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:items-start" onSubmit={send} noValidate>
        <div className="space-y-7">
        <Section id="party" n={1} title={t('bk.step.party')} done={steps[0].done}>
          <div className="flex items-center gap-4">
            <button type="button" className={`${btn} !w-12 !px-0`} aria-label={t('bk.lessPerson')} disabled={party <= 1} onClick={() => { setParty(p => p - 1); setPartyTouched(true); }}><Minus size={18} /></button>
            <span className="text-3xl font-semibold tabular-nums w-12 text-center" aria-live="polite">{party}</span>
            <button type="button" className={`${btn} !w-12 !px-0`} aria-label={t('bk.morePerson')} disabled={party >= info.max_party} onClick={() => { setParty(p => p + 1); setPartyTouched(true); }}><Plus size={18} /></button>
            <span className="text-sm text-[var(--text-muted)]"><Users size={14} className="inline mr-1" />{t('bk.personWord', { count: party })}</span>
          </div>
          {party >= info.max_party && <p className="text-sm text-[var(--text-muted)]">{info.phone ? t('bk.groupBigPhone', { max: info.max_party, phone: info.phone }) : t('bk.groupBig', { max: info.max_party })}</p>}
        </Section>

        <Section id="day" n={2} title={t('bk.step.day')} done={steps[1].done}>
          {!days ? <Loading /> : (
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('pub.day')}>
              {weekdays.map(d => (
                <button key={d.date} type="button" role="radio" aria-checked={date === d.date} disabled={!d.available} onClick={() => setDate(d.date)}
                  className={`h-14 rounded-lg border text-sm leading-tight cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${date === d.date ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
                  <span className="block capitalize">{d.label.split(' ').slice(0, 1)}</span>
                  <span className="block tabular-nums">{d.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          )}
          {days && !days.some(d => d.available) && <p className="text-sm text-[var(--text-muted)]">{t('bk.noAvail', { count: party, days: info.max_days })}</p>}
        </Section>

        {date && (
          <Section id="time" n={3} title={t('bk.step.time')} done={steps[2].done}>
            {!shifts ? <Loading /> : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('bk.shift')}>
                {shifts.map(s => (
                  <button key={s.id} type="button" role="radio" aria-checked={shiftId === s.id} disabled={!s.available} onClick={() => setShiftId(s.id)}
                    className={`h-14 rounded-lg border text-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${shiftId === s.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
                    <span className="block text-base tabular-nums"><Clock size={14} className="inline mr-1 -mt-0.5" />{s.start_time}</span>
                    <span className="block text-xs opacity-80">{s.available ? s.name : t('bk.unavailable')}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        </div>

        <div className="mt-7 sm:mt-0 space-y-7">
        {!shiftId && <p className="hidden sm:block text-sm text-[var(--text-muted)] rounded-xl border border-dashed border-[var(--border)] p-5">{t('bk.pickHint')}</p>}
        {shiftId && (
          <Section id="details" n={4} title={t('bk.step.details')} done={steps[3].done}>
            <div className="space-y-3">
              <label className="block"><span className="text-sm font-medium">{t('pub.name')}</span>
                <input className={`${input} !text-base !h-12 mt-1`} autoComplete="name" value={form.customer_name} onChange={setField('customer_name')} maxLength={80} required /></label>
              <label className="block"><span className="text-sm font-medium">{t('pub.phone')}</span>
                <input className={`${input} !text-base !h-12 mt-1`} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} maxLength={40} required /></label>
              <label className="block"><span className="text-sm font-medium">{t('pub.email')} <span className="text-[var(--text-muted)] font-normal">{t('pub.optionalF')}</span></span>
                <input className={`${input} !text-base !h-12 mt-1`} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={setField('email')} maxLength={120} /></label>
              <label className="block"><span className="text-sm font-medium">{t('pub.notes')} <span className="text-[var(--text-muted)] font-normal">{t('bk.notesHint')}</span></span>
                <textarea className={`${input} !text-base mt-1 !h-24 py-2`} value={form.notes} onChange={setField('notes')} maxLength={500} /></label>
              {/* Campo trappola: le persone non lo vedono */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Sito web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={setField('website')} /></label>
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--accent)]" checked={form.consent} onChange={setField('consent')} />
                <span className="text-[var(--text-muted)]">{t('bk.consent')}</span>
              </label>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--accent)]" checked={form.marketing} onChange={e => setForm(f => ({ ...f, marketing: e.target.checked }))} />
                <span className="text-[var(--text-muted)]">{t('bk.marketing')}</span>
              </label>
            </div>

            <div className="rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] p-3 text-sm flex items-center gap-2">
              <CalendarDays size={16} className="text-[var(--accent)] shrink-0" />
              <span><b>{formatDay(date, { lang })}</b> · {shift?.start_time} · {party} {t('bk.personWord', { count: party })}</span>
            </div>
            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            {/* Il pulsante resta sempre a portata di pollice, anche scorrendo il modulo */}
            <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-[var(--bg-main)] border-t border-[var(--border)] space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button type="submit" className={`${btnPrimary} w-full !h-12 !text-base`} disabled={!valid || sending}>{sending ? t('pub.sending') : t('bk.submit')}</button>
              <p className="text-xs text-[var(--text-muted)] text-center">{t('bk.notYet')}</p>
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
