import { useState, useMemo, useEffect } from 'react';
import { Search, Minus, Plus, Phone, Store } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import { btn, btnPrimary, input, label, segment, segmentBox } from '../floor/ui';
import { formatEuro, normalizeText } from '../floor/checkMath';
import { addToCart, cartCount, cartTotal, cartLoad } from './rules';

// L'ordine preso al banco o al telefono: a sinistra la carta (stessa disposizione della cassa), a destra il riepilogo
// con nome, telefono e fascia di ritiro. Nasce già accettato e va subito in cucina.
export const ProductPicker = ({ products, cart, onAdd }) => {
  const [category, setCategory] = useState('Tutti');
  const [search, setSearch] = useState('');
  const categories = useMemo(() => ['Tutti', ...new Set((products ?? []).map(p => p.category || 'Generico'))], [products]);
  const shown = useMemo(() => {
    const words = normalizeText(search).trim().split(/\s+/).filter(Boolean);
    return (products ?? []).filter(p => (category === 'Tutti' || (p.category || 'Generico') === category) && words.every(w => normalizeText(`${p.name} ${p.category || ''}`).includes(w)));
  }, [products, category, search]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-2 pb-3 shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input type="text" placeholder="Cerca prodotto…" aria-label="Cerca prodotto" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-[var(--text-main)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>
      <div className="flex gap-1.5 pb-3 overflow-x-auto no-scrollbar shrink-0" role="tablist" aria-label="Categoria">
        {categories.map(c => (
          <button key={c} role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
            className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap border cursor-pointer ${category === c ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{c}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {!products && <p className="text-sm text-[var(--text-muted)]">Caricamento carta…</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {shown.map(p => {
            const n = cart.find(l => l.id === p.id)?.quantity ?? 0;
            return (
              <button key={p.id} onClick={() => onAdd(p, 1)} className="relative text-left rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] p-3 min-h-[76px] flex flex-col justify-between hover:border-[var(--border-hover)] active:scale-[0.98] transition cursor-pointer">
                <span className="text-sm font-medium leading-tight text-[var(--text-main)]">{p.name}</span>
                <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)] mt-2">{formatEuro(p.price)}</span>
                {n > 0 && <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-semibold flex items-center justify-center tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
          <ul className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {cart.map(l => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card-2)]">
                <span className="min-w-0 flex-1 text-sm text-[var(--text-main)] truncate">{l.name}</span>
                <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card)] cursor-pointer" aria-label={`Una in meno: ${l.name}`} onClick={() => setCart(c => addToCart(c, l, -1))}><Minus size={16} /></button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card)] cursor-pointer" aria-label={`Una in più: ${l.name}`} onClick={() => setCart(c => addToCart(c, l, 1))}><Plus size={16} /></button>
                <span className="w-16 text-right text-sm tabular-nums text-[var(--text-muted)]">{formatEuro(l.price * l.quantity)}</span>
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
          <div><label className={label} htmlFor="t-phone">Telefono</label><input id="t-phone" className={`${input} mt-1`} type="tel" inputMode="tel" value={form.phone} maxLength={40} onChange={set('phone')} autoComplete="off" /></div>
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
