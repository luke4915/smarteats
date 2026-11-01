import { useState, useEffect, useMemo, useRef } from 'react';
import { Minus, Plus, ShoppingBag, ChevronLeft, Phone } from 'lucide-react';
import StatusMark from '../components/public/StatusMark';
import PaymentChoice from '../components/public/PaymentChoice';
import PaymentBox from '../components/public/PaymentBox';
import { paymentNote, totalLabel } from '../components/public/paymentText';
import { apiFetch } from '../utils/apiClient';
import { formatDay } from '../modules/bookings/rules';
import { btnPrimary, btn, input } from '../components/shared/styles';
import { formatEuro } from '../utils/format';
import { PublicShell, StepSection } from '../components/public/PublicShell';
import StepProgress from '../components/public/StepProgress';
import { checkoutTarget } from '../utils/checkoutUrl';
import { CategoryChips, ProductRows } from '../components/public/MenuList';
import Loading from '../components/shared/Loading';
import { useT, useEffectiveLanguage } from '../i18n/useLanguage';

// Pagina pubblica per ordinare da asporto (`/order`): il cliente sceglie i prodotti, il giorno e la fascia di ritiro,
// lascia nome e telefono e invia una *richiesta*: il locale la approva. Si paga al ritiro. `/order/<codice>` è la
// pagina di stato. Pensata per il telefono. Prezzi, fasce e capienza li decide il server.

const STATUS_KEYS = ['requested', 'accepted', 'picked_up', 'rejected', 'cancelled', 'expired'];

// Come si presenta l'esito: spunta se confermato o ritirato, X se non è andato a buon fine, orologio in attesa del locale.
const TONE = { requested: 'waiting', accepted: 'good', picked_up: 'good', rejected: 'bad', cancelled: 'bad', expired: 'bad' };

const Status = ({ token, info }) => {
  const t = useT();
  const lang = useEffectiveLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => apiFetch(`/public/takeaway/orders/${token}`).then(d => alive && setData(d))
      .catch(err => alive && setError(err.status === 404 ? t('or.notFound') : err.message));
    load();
    // l'esito arriva da solo, senza ricaricare; appena tornati dalla pagina di pagamento si controlla più spesso (la conferma di Stripe arriva in pochi secondi)
    const timer = setInterval(load, new URLSearchParams(window.location.search).has('pagamento') ? 3_000 : 20_000);
    return () => { alive = false; clearInterval(timer); };
  }, [token, t]);

  // Ha chiuso la pagina di pagamento: se ne apre una nuova
  const pay = async () => {
    setBusy(true); setError('');
    try { window.location.assign(checkoutTarget((await apiFetch(`/public/takeaway/orders/${token}/pay`, { method: 'POST', body: {} })).checkout_url)); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true); setError('');
    try { setData(await apiFetch(`/public/takeaway/orders/${token}/cancel`, { method: 'POST', body: {} })); setAsking(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (error && !data) return <p className="text-sm text-red-500" role="alert">{error}</p>;
  if (!data) return <Loading />;
  const key = STATUS_KEYS.includes(data.status) ? data.status : 'requested';
  const text = { title: t(`or.status.${key}.title`), body: t(`or.status.${key}.body`) };
  const note = paymentNote(data.payment, data.status, t);
  const phone = data.restaurant.phone || info?.phone;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StatusMark tone={TONE[data.status]} />
          <h2 className="text-lg font-semibold">{text.title}</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{text.body}</p>
        {note && <PaymentBox note={note} onPay={pay} busy={busy} />}
        {data.pickup_code && (
          <div className="rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] px-4 py-3 text-center">
            <p className="text-xs text-[var(--text-muted)]">{t('or.pickupCode')}</p>
            <p className="text-4xl font-semibold tabular-nums tracking-[0.12em] text-[var(--text-main)]" aria-label={t('or.pickupCodeAria', { code: data.pickup_code.split('').join(' ') })}>{data.pickup_code}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('or.sayAtCounter')}</p>
          </div>
        )}
        {data.status === 'rejected' && data.reject_reason && <p className="text-sm">«{data.reject_reason}»</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm pt-2 border-t border-[var(--border)]">
          <dt className="text-[var(--text-muted)]">{t('or.pickup')}</dt><dd className="font-medium">{formatDay(data.date, { lang })} · {data.time}</dd>
          <dt className="text-[var(--text-muted)]">{t('pub.underName')}</dt><dd className="font-medium">{data.customer_name}</dd>
        </dl>
        <ul className="pt-2 border-t border-[var(--border)] space-y-1.5 text-sm">
          {data.items.map((i, n) => <li key={n} className="flex gap-3"><span className="w-6 tabular-nums font-medium">{i.quantity}×</span><span className="flex-1">{i.name}{i.note && <span className="block text-xs text-[var(--text-muted)]">{i.note}</span>}</span></li>)}
          <li className="flex justify-between pt-2 border-t border-[var(--border)] font-semibold"><span>{totalLabel(data.payment, data.status, t)}</span><span className="tabular-nums">{formatEuro(data.total)}</span></li>
        </ul>
      </div>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      {data.can_cancel && (asking ? (
        <div className="rounded-xl border border-red-500/40 p-4 space-y-3">
          <p className="text-sm">{t('or.withdrawAsk')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} onClick={() => setAsking(false)}>{t('pub.keep')}</button>
            <button className="inline-flex items-center justify-center h-11 rounded-lg bg-red-500 text-white text-sm font-medium cursor-pointer disabled:opacity-50" disabled={busy} onClick={cancel}>{t('pub.yesWithdraw')}</button>
          </div>
        </div>
      ) : <button className={`${btn} w-full`} onClick={() => setAsking(true)}>{t('pub.withdraw')}</button>)}
      {!data.can_cancel && ['accepted'].includes(data.status) && <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm">{t('or.callToChange')}</p>}
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={`${btn} w-full`}><Phone size={16} /> {t('pub.callVenue')}</a>}
    </div>
  );
};

const OrderPage = () => {
  const t = useT();
  const lang = useEffectiveLanguage();
  const token = window.location.pathname.split('/').filter(Boolean)[1] ?? null;   // /order/<codice>
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({});            // { [productId]: quantità }
  const [category, setCategory] = useState('');
  const [step, setStep] = useState('menu');        // 'menu' | 'checkout'
  const [days, setDays] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', notes: '', consent: false, website: '' });
  const [sending, setSending] = useState(false);
  const [payChoice, setPayChoice] = useState('online');     // «Paga ora» di partenza: chi paga subito lo trova pronto
  const openedAt = useRef(Date.now());

  useEffect(() => {
    apiFetch('/public/takeaway/info').then(i => { setInfo(i); setCategory(i.categories[0] ?? ''); })
      .catch(err => setError(err.code === 'PORTAL_OFF' || err.status === 404 || err.status === 403 ? t('or.off') : err.message));
  }, [t]);

  const lines = useMemo(() => (info ? info.products.filter(p => cart[p.id] > 0).map(p => ({ ...p, quantity: cart[p.id] })) : []), [info, cart]);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const cartParam = lines.map(l => `${l.id}:${l.quantity}`).join(',');   // il server calcola da qui quali fasce ci stanno
  const total = lines.reduce((s, l) => s + Math.round(l.price * 100) * l.quantity, 0) / 100;
  const change = (id, delta) => setCart(c => { const q = Math.max(0, (c[id] ?? 0) + delta); const next = { ...c, [id]: q }; if (!q) delete next[id]; return next; });

  useEffect(() => {
    if (!info || token || step !== 'checkout') return;
    apiFetch('/public/takeaway/days').then(r => setDays(r.days)).catch(err => setError(err.message));
  }, [info, token, step]);
  useEffect(() => {
    if (!date) { setSlots(null); return; }
    let cancelled = false;
    setTime('');
    apiFetch(`/public/takeaway/slots?date=${date}&cart=${cartParam}`).then(r => { if (!cancelled) setSlots(r.slots); }).catch(err => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [date, cartParam]);

  const payMode = info?.payments?.mode ?? 'off';
  const payNow = payChoice === 'online' && ['optional', 'required'].includes(payMode);
  const valid = payMode !== 'unavailable' && lines.length > 0 && date && time && form.customer_name.trim() && form.phone.replace(/\D/g, '').length >= 6 && form.consent;
  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // I pallini in cima: ogni passo si completa da solo mentre si compila. «Come paghi?» ha già una scelta di partenza: è a posto quando i passi prima lo sono.
  const detailsDone = !!form.customer_name.trim() && form.phone.replace(/\D/g, '').length >= 6 && form.consent;
  const beforePayment = count > 0 && !!date && !!time && detailsDone;
  const steps = [
    { id: 'order', label: t('or.step.order'), done: count > 0 },
    { id: 'pickup', label: t('or.step.pickup'), done: !!date && !!time },
    { id: 'details', label: t('or.step.details'), done: detailsDone },
    ...(payMode !== 'off' ? [{ id: 'payment', label: t('or.step.payment'), done: beforePayment && payMode !== 'unavailable' }] : []),
  ];

  const send = async (e) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true); setError('');
    try {
      const res = await apiFetch('/public/takeaway/orders', { method: 'POST', body: { date, time, items: lines.map(l => ({ id: l.id, quantity: l.quantity })), ...form, pay_online: payNow, opened_at: openedAt.current } });
      window.location.assign(res.checkout_url ? checkoutTarget(res.checkout_url) : `/order/${res.token}`);       // con la carta si passa dalla pagina di pagamento
    } catch (err) {
      setError(err.message);
      if (err.code === 'SLOT_FULL') { setTime(''); apiFetch(`/public/takeaway/slots?date=${date}&cart=${cartParam}`).then(r => setSlots(r.slots)).catch(() => {}); }
    } finally { setSending(false); }
  };

  if (error && !info) return <PublicShell translated={['it', 'en']}><p className="text-sm text-[var(--text-muted)] text-center py-10" role="alert">{error}</p></PublicShell>;
  if (!info) return <PublicShell translated={['it', 'en']}><Loading /></PublicShell>;
  if (token) return <PublicShell translated={['it', 'en']} info={info} kicker={t('or.kickerStatus')}><Status token={token} info={info} /></PublicShell>;

  const products = info.products.filter(p => p.category === category);

  // Barra in basso sempre a portata di pollice
  const bar = count > 0 && step === 'menu' && (
    <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-[var(--bg-main)] border-t border-[var(--border)]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <button className={`${btnPrimary} w-full !h-12 !text-base justify-between`} onClick={() => setStep('checkout')}>
        <span className="flex items-center gap-2"><ShoppingBag size={18} /> {t('or.items', { count })}</span><span>{t('or.continue')} · {formatEuro(total)}</span>
      </button>
    </div>
  );

  return (
    <PublicShell translated={['it', 'en']} info={info} kicker={t('or.kicker')} footer={bar}>
      <StepProgress steps={steps} />
      {step === 'menu' && (
        <>
          <CategoryChips categories={info.categories} value={category} onChange={setCategory} />
          <ProductRows products={products} quantities={cart} onChange={change} />
          {info.products.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('or.noProducts')}</p>}
        </>
      )}

      {step === 'checkout' && (
        <form className="flex flex-col gap-7" onSubmit={send} noValidate>
          <button type="button" className="flex items-center gap-1 text-sm text-[var(--accent)] font-medium cursor-pointer self-start" onClick={() => setStep('menu')}><ChevronLeft size={18} /> {t('or.editOrder')}</button>

          <StepSection id="order" n={1} title={t('or.step.order')} done={steps[0].done}>
            <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
              {lines.map(l => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">{l.name}</span>
                  <button type="button" className={`${btn} !w-9 !h-9 !px-0`} aria-label={t('menu.less', { name: l.name })} onClick={() => change(l.id, -1)}><Minus size={16} /></button>
                  <span className="w-5 text-center font-semibold tabular-nums">{l.quantity}</span>
                  <button type="button" className={`${btn} !w-9 !h-9 !px-0`} aria-label={t('menu.more', { name: l.name })} onClick={() => change(l.id, 1)}><Plus size={16} /></button>
                  <span className="w-16 text-right text-sm tabular-nums text-[var(--text-muted)]">{formatEuro(l.price * l.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between px-4 py-3 font-semibold"><span>{payNow ? t('or.totalNow') : t('or.totalLater')}</span><span className="tabular-nums">{formatEuro(total)}</span></li>
            </ul>
            {lines.length === 0 && <button type="button" className={`${btn} w-full`} onClick={() => setStep('menu')}>{t('or.chooseProducts')}</button>}
          </StepSection>

          <StepSection id="pickup" n={2} title={t('or.step.pickup')} done={steps[1].done}>
            {!days ? <Loading /> : (
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('pub.day')}>
                {days.map(d => {
                  const label = formatDay(d.date, { short: true, lang });
                  return (
                    <button key={d.date} type="button" role="radio" aria-checked={date === d.date} disabled={!d.available} onClick={() => setDate(d.date)}
                      className={`h-14 rounded-lg border text-sm leading-tight cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${date === d.date ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>
                      <span className="block capitalize">{label.split(' ')[0]}</span><span className="block tabular-nums">{label.split(' ').slice(1).join(' ')}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {days && !days.some(d => d.available) && <p className="text-sm text-[var(--text-muted)]">{t('or.noSlotsDays')}</p>}
            {date && (
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('or.pickupTime')}>
                {(slots ?? []).map(s => (
                  <button key={s.time} type="button" role="radio" aria-checked={time === s.time} disabled={!s.available} onClick={() => setTime(s.time)}
                    className={`h-12 rounded-lg border text-base tabular-nums cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${time === s.time ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}>{s.time}</button>
                ))}
                {slots && slots.length === 0 && <p className="col-span-4 text-sm text-[var(--text-muted)]">{t('or.noPickupDay')}</p>}
              </div>
            )}
          </StepSection>

          <StepSection id="details" n={3} title={t('or.step.details')} done={steps[2].done}>
            <div className="space-y-3">
              <label className="block"><span className="text-sm font-medium">{t('pub.name')}</span>
                <input className={`${input} !text-base !h-12 mt-1`} autoComplete="name" value={form.customer_name} onChange={setField('customer_name')} maxLength={80} required /></label>
              <label className="block"><span className="text-sm font-medium">{t('pub.phone')}</span>
                <input className={`${input} !text-base !h-12 mt-1`} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} maxLength={40} required /></label>
              <label className="block"><span className="text-sm font-medium">{t('pub.notes')} <span className="text-[var(--text-muted)] font-normal">{t('pub.optionalP')}</span></span>
                <textarea className={`${input} !text-base mt-1 !h-20 py-2`} value={form.notes} onChange={setField('notes')} maxLength={500} /></label>
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Sito web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={setField('website')} /></label>
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[var(--accent)]" checked={form.consent} onChange={setField('consent')} />
                <span className="text-[var(--text-muted)]">{t('or.consent')}</span>
              </label>
            </div>
          </StepSection>

          {payMode !== 'off' && <StepSection id="payment" n={4} title={t('or.step.payment')} done={steps[3].done}><PaymentChoice mode={payMode} value={payNow ? 'online' : 'on_pickup'} onChange={setPayChoice} /></StepSection>}

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-[var(--bg-main)] border-t border-[var(--border)] space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="submit" className={`${btnPrimary} w-full !h-12 !text-base`} disabled={!valid || sending}>{sending ? t('pub.sending') : payNow ? t('or.goPay', { total: formatEuro(total) }) : t('or.send', { total: formatEuro(total) })}</button>
            <p className="text-xs text-[var(--text-muted)] text-center">{payNow ? t('or.notConfirmedCard') : t('or.notConfirmed')}</p>
          </div>
        </form>
      )}
    </PublicShell>
  );
};

export default OrderPage;
