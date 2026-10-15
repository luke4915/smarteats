import { useState, useRef, useMemo } from 'react';
import { Minus, Plus, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { fetchWithAuth, NetworkError } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { printFired } from './printFired';
import PanelFrame from './PanelFrame';
import LineEditor from './LineEditor';
import { cartTotal, formatEuro } from './checkMath';
import { buildSchedule, toPayload, sendSummary, moveUscita, mergeWithPrevious } from './courses';
import { btnPrimary, iconBtn } from './ui';

// La comanda in preparazione per un tavolo, disposta in «uscite»: cosa esce subito e cosa dopo, e cosa esce insieme
// (secondi e contorni nella stessa uscita). I piatti si dividono da soli per portata; ogni piatto si può spostare in
// un'altra uscita toccandolo. Alla conferma esce la prima uscita, le altre restano sul conto «da mandare».
// Le comande dei tavoli richiedono il server: lo stato del conto è condiviso fra i dispositivi.
const DraftOrder = ({ detail, service, cart, setCart, products, courses, onBack, onSent }) => {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);       // indice della riga aperta nell'editor
  const [holdAll, setHoldAll] = useState(false);      // non mandare niente ora
  const [sending, setSending] = useState(false);
  // Una chiave per portata e uscita: se la risposta si perde e si preme di nuovo, il giro non si duplica.
  const attempt = useRef({});

  const schedule = useMemo(() => buildSchedule(cart, courses), [cart, courses]);
  const several = schedule.uscite.length > 1;
  const summary = sendSummary(schedule, !holdAll);
  const total = cartTotal(cart);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  const stockOk = (line, extra = 1) => {
    const product = products?.find(p => p.id === line.id);
    if (!product?.stock_enabled || product.stock === null) return true;
    return cart.filter(l => l.id === line.id).reduce((s, l) => s + l.quantity, 0) + extra <= product.stock;
  };
  const change = (line, delta) => setCart(c => c.flatMap(l => {
    if (l !== line) return [l];
    const quantity = l.quantity + delta;
    return quantity > 0 ? [{ ...l, quantity }] : [];
  }));
  const increase = (line) => (stockOk(line) ? change(line, 1) : showToast(`"${line.name}": disponibilità esaurita`, 'warning'));
  const removeAt = (index) => setCart(c => c.filter((_, i) => i !== index));

  const send = async () => {
    if (!navigator.onLine) return showToast('Senza connessione non si inviano comande ai tavoli', 'error');
    setSending(true);
    try {
      const payload = toPayload(schedule).map(g => ({ ...g, client_order_id: (attempt.current[`${g.seq}:${g.course_id ?? 0}`] ??= crypto.randomUUID()) }));
      const res = await fetchWithAuth(`/checks/${detail.id}/courses`, { method: 'POST', body: { groups: payload, fire_first: !holdAll } });
      if (res.duplicate) showToast('Comanda già inviata', 'info');
      else {
        await printFired(res.orders, res.fired, detail, service, showToast);
        showToast(res.fired.length ? 'Comanda inviata in cucina' : 'Comanda salvata: da mandare', 'success');
      }
      attempt.current = {};
      onSent();
    } catch (err) {
      showToast(err instanceof NetworkError ? 'Server non raggiungibile: la comanda non è stata inviata' : err.message, 'error');
    } finally { setSending(false); }
  };

  if (editing !== null && cart[editing]) {
    return <LineEditor line={cart[editing]} index={editing} schedule={schedule} canIncrease={stockOk(cart[editing])}
      onChange={(fn) => setCart(fn)} onRemove={() => removeAt(editing)} onBack={() => setEditing(null)} />;
  }

  const lineRow = (line) => {
    const index = cart.indexOf(line);
    return (
      <div key={`${line.id}-${index}`} className="flex items-center gap-2 py-1.5">
        <div className="flex items-center shrink-0">
          <button className={`${iconBtn} !p-2.5`} aria-label={`Una in meno: ${line.name}`} onClick={() => change(line, -1)}><Minus size={16} /></button>
          <span className="w-7 text-center text-base font-semibold tabular-nums text-[var(--text-main)]">{line.quantity}</span>
          <button className={`${iconBtn} !p-2.5`} aria-label={`Una in più: ${line.name}`} onClick={() => increase(line)}><Plus size={16} /></button>
        </div>
        <button className="flex-1 min-w-0 text-left py-1 cursor-pointer" onClick={() => setEditing(index)} aria-label={`Modifica ${line.name}`}>
          <span className="block text-base text-[var(--text-main)] leading-snug">{line.name}</span>
          {(line.modifiers?.length > 0 || line.note) && (
            <span className="block text-sm text-[var(--text-muted)] leading-snug">{[...(line.modifiers ?? []).map(m => m.name), line.note].filter(Boolean).join(' · ')}</span>
          )}
        </button>
        <span className="text-base tabular-nums text-[var(--text-main)] shrink-0">{formatEuro(line.price * line.quantity)}</span>
        <button className="p-1 text-[var(--text-muted)] shrink-0" aria-label={`Apri ${line.name}`} onClick={() => setEditing(index)}><ChevronRight size={18} /></button>
      </div>
    );
  };

  return (
    <PanelFrame title="Comanda" subtitle={`${detail.table_name} · ${detail.covers} coperti`} onBack={onBack}
      footer={
        <>
          <div className="flex justify-between items-baseline">
            <span className="text-base text-[var(--text-muted)]">{count} {count === 1 ? 'piatto' : 'piatti'}</span>
            <span className="text-3xl font-semibold tabular-nums text-[var(--text-main)]">{formatEuro(total)}</span>
          </div>
          {summary.now !== null || summary.later.length > 0 ? (
            <div className="rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] p-3 space-y-1 text-base">
              {summary.now !== null && <p className="text-[var(--text-main)]"><span className="text-[var(--text-muted)]">Subito · </span>{summary.now}</p>}
              {summary.later.length > 0 && <p className="text-[var(--text-main)]"><span className="text-[var(--text-muted)]">{summary.now !== null ? 'Poi · ' : 'Da mandare · '}</span>{summary.later.join('  →  ')}</p>}
              {several && (
                <label className="flex items-center gap-2.5 pt-1.5 text-sm text-[var(--text-muted)] select-none">
                  <input type="checkbox" checked={holdAll} onChange={e => setHoldAll(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" /> Non mandare niente ora
                </label>
              )}
            </div>
          ) : null}
          <button className={`${btnPrimary} w-full !h-14 !text-base`} disabled={!cart.length || sending} onClick={send}>
            {sending ? 'Invio…' : holdAll ? 'Salva la comanda' : 'Invia in cucina'}
          </button>
        </>
      }>
      {cart.length === 0 && <p className="h-full flex items-center justify-center text-center text-[var(--text-muted)] text-base py-10">Tocca un piatto nella carta</p>}

      {!several && schedule.uscite[0]?.courses.map(c => <div key={c.key} className="px-1">{c.lines.map(lineRow)}</div>)}

      {several && (
        <ol className="px-1">
          {schedule.uscite.map((u, i) => (
            <li key={u.raw} className="relative pl-11 pb-5 last:pb-1">
              <span className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-base font-semibold ${i === 0 && !holdAll ? 'bg-[var(--accent)] text-white' : 'border-2 border-[var(--border-hover)] text-[var(--text-main)]'}`}>{u.index}</span>
              {i < schedule.uscite.length - 1 && <span className="absolute left-4 top-9 -bottom-1 w-px bg-[var(--border)]" aria-hidden="true" />}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[var(--text-main)] leading-8">{i === 0 ? (holdAll ? 'In attesa' : 'Esce subito') : 'Poi'}</h3>
                </div>
                <button className={iconBtn} aria-label={`Anticipa l'uscita ${u.index}`} disabled={i === 0} onClick={() => setCart(c => moveUscita(c, schedule, i, -1))}><ArrowUp size={18} /></button>
                <button className={iconBtn} aria-label={`Posticipa l'uscita ${u.index}`} disabled={i === schedule.uscite.length - 1} onClick={() => setCart(c => moveUscita(c, schedule, i, +1))}><ArrowDown size={18} /></button>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-1 divide-y divide-[var(--border)]">
                {u.courses.map(c => (
                  <div key={c.key} className="py-1.5">
                    <p className="text-sm font-medium text-[var(--text-muted)]">{c.name}</p>
                    {c.lines.map(lineRow)}
                  </div>
                ))}
              </div>
              {i > 0 && (
                <button className="mt-2 text-sm font-medium text-[var(--accent)]" onClick={() => setCart(c => mergeWithPrevious(c, schedule, i))}>
                  Falla uscire insieme alla precedente
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </PanelFrame>
  );
};

export default DraftOrder;
