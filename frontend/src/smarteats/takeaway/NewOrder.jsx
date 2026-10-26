import { useState, useEffect } from 'react';
import { Minus, Plus, Phone, Store } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import { btn, btnPrimary, iconBtn, input, label, segment, segmentBox } from '../floor/ui';
import { formatEuro } from '../floor/checkMath';
import { addToCart, cartCount, cartTotal, cartLoad } from './rules';

// L'ordine preso al banco o al telefono: a sinistra la carta comune (`ProductPicker`, la stessa della Sala), a destra il riepilogo
// con nome, telefono e fascia di ritiro. Nasce già accettato e va subito in cucina.
const NewOrder = ({ date, cart, setCart, onBack, onCreated }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({ customer_name: '', phone: '', notes: '', source: 'counter', date, time: '' });
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(null);

  const load = cartLoad(cart);
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(`/takeaway/slots?date=${form.date}&load=${Math.max(load, 1)}`).then(r => { if (!cancelled) setSlots(r.slots.filter(s => s.status !== 'closed')); }).catch(() => {});
    return () => { cancelled = true; };
  }, [form.date, load]);
  // La prima fascia libera è già scelta: al banco serve rapidità
  useEffect(() => {
    if (!form.time || !slots.some(s => s.time === form.time)) {
      const first = slots.find(s => s.available) ?? slots[0];
      setForm(f => ({ ...f, time: first?.time ?? '' }));
    }
  }, [slots, form.time]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = cart.length > 0 && form.customer_name.trim() && form.time;

  const submit = async (ignoreCapacity = false) => {
    setBusy(true); setFull(null);
    try {
      const body = { date: form.date, time: form.time, customer_name: form.customer_name.trim(), phone: form.phone.trim(), notes: form.notes.trim(), source: form.source,
        items: cart.map(l => ({ id: l.id, quantity: l.quantity, note: l.note })), ignore_capacity: ignoreCapacity };
      const order = await fetchWithAuth('/takeaway/orders', { method: 'POST', body });
      showToast('Ordine inserito: va in cucina', 'success');
      onCreated(order);
    } catch (err) {
      if (err.code === 'SLOT_FULL') setFull(err.message); else showToast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <PanelFrame title="Nuovo ordine" subtitle={`${cartCount(cart)} ${cartCount(cart) === 1 ? 'articolo' : 'articoli'} · ${formatEuro(cartTotal(cart))}`} onBack={onBack}
      footer={
        full ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-500">{full}</p>
            <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setFull(null)}>Scelgo un'altra fascia</button><button className={btnPrimary} disabled={busy} onClick={() => submit(true)}>Accetta comunque</button></div>
          </div>
        ) : <button className={`${btnPrimary} w-full !h-12`} disabled={!valid || busy} onClick={() => submit(false)}>Inserisci l'ordine · {formatEuro(cartTotal(cart))}</button>
      }>
      <div className="px-1 space-y-4 pb-2">
        {cart.length === 0 ? <p className="text-sm text-[var(--text-muted)] py-6 text-center">Tocca i prodotti a sinistra per aggiungerli.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {cart.map(l => (
              <li key={l.id} className="flex items-center gap-2 py-1.5">
                <div className="flex items-center shrink-0">
                  <button className={`${iconBtn} !p-2.5`} aria-label={`Una in meno: ${l.name}`} onClick={() => setCart(c => addToCart(c, l, -1))}><Minus size={16} /></button>
                  <span className="w-7 text-center text-base font-semibold tabular-nums text-[var(--text-main)]">{l.quantity}</span>
                  <button className={`${iconBtn} !p-2.5`} aria-label={`Una in più: ${l.name}`} onClick={() => setCart(c => addToCart(c, l, 1))}><Plus size={16} /></button>
                </div>
                <span className="flex-1 min-w-0 text-base text-[var(--text-main)] leading-snug">{l.name}</span>
                <span className="text-base tabular-nums text-[var(--text-main)] shrink-0">{formatEuro(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={segmentBox} role="tablist" aria-label="Come arriva l'ordine">
          <button role="tab" aria-selected={form.source === 'counter'} className={`${segment(form.source === 'counter')} flex items-center justify-center gap-1.5`} onClick={() => setForm(f => ({ ...f, source: 'counter' }))}><Store size={15} /> Al banco</button>
          <button role="tab" aria-selected={form.source === 'phone'} className={`${segment(form.source === 'phone')} flex items-center justify-center gap-1.5`} onClick={() => setForm(f => ({ ...f, source: 'phone' }))}><Phone size={15} /> Al telefono</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={label} htmlFor="t-name">Nome</label><input id="t-name" className={`${input} mt-1`} value={form.customer_name} maxLength={80} onChange={set('customer_name')} autoComplete="off" /></div>
          <div><label className={label} htmlFor="t-phone">Telefono</label><input id="t-phone" className={`${input} mt-1`} type="tel" inputMode="tel" value={form.phone} maxLength={40} onChange={set('phone')} autoComplete="off" />
            <p className="text-[11px] leading-tight text-[var(--text-muted)] mt-1">Cellulare = avvisi su WhatsApp</p></div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className={label}>Ritiro</p>
            <input type="date" aria-label="Giorno di ritiro" value={form.date} onChange={e => e.target.value && setForm(f => ({ ...f, date: e.target.value, time: '' }))}
              className="h-8 px-2 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-xs text-[var(--text-main)]" />
          </div>
          {slots.length === 0 && <p className="text-sm text-[var(--text-muted)] mt-2">In questo giorno l'asporto non è attivo: imposta gli orari in Impostazioni.</p>}
          <div className="grid grid-cols-4 gap-1.5 mt-2" role="radiogroup" aria-label="Fascia di ritiro">
            {slots.map(s => {
              const on = form.time === s.time;
              return (
                <button key={s.time} role="radio" aria-checked={on} onClick={() => setForm(f => ({ ...f, time: s.time }))}
                  className={`h-12 rounded-lg border text-center cursor-pointer leading-tight ${on ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : s.available ? 'border-[var(--border)] bg-[var(--bg-card-2)] text-[var(--text-main)] hover:border-[var(--accent)]' : 'border-amber-500/40 bg-amber-500/5 text-amber-500'}`}>
                  <span className="block text-sm font-semibold tabular-nums">{s.time}</span>
                  <span className="block text-[10px] tabular-nums opacity-80">{s.load}/{s.capacity}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div><label className={label} htmlFor="t-notes">Note</label><textarea id="t-notes" className={`${input} mt-1 !h-16 py-2`} value={form.notes} maxLength={500} onChange={set('notes')} /></div>
      </div>
    </PanelFrame>
  );
};

export default NewOrder;
