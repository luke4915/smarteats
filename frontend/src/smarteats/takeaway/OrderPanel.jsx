import { useState } from 'react';
import { Phone, Clock, StickyNote, X, Banknote, CreditCard, Wallet } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import { btn, btnPrimary, btnDanger, input } from '../floor/ui';
import { formatEuro } from '../../utils/format';
import { STATUS, SOURCE, shownStatus } from './rules';
import { formatDay } from '../reservations/rules';
import WhatsAppStatus from '../notifications/WhatsAppStatus';

const METHODS = [['cash', 'Contanti', Banknote], ['card', 'Carta', CreditCard], ['other', 'Altro', Wallet]];
const TONES = {
  amber: 'bg-amber-500/15 text-amber-500', green: 'bg-emerald-500/15 text-emerald-500',
  accent: 'bg-[var(--accent)]/15 text-[var(--accent)]', muted: 'bg-[var(--bg-card-2)] text-[var(--text-muted)]',
};

// Un ordine da asporto nel pannello a destra: cosa c'è dentro, chi lo ritira e quando, e l'azione giusta per lo stato:
// approvare o rifiutare una richiesta; consegnare e incassare un ordine accettato.
const OrderPanel = ({ order, slots, onBack, onChanged }) => {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);          // 'reject' | 'pay' | 'cancel'
  const [reason, setReason] = useState('');
  const [time, setTime] = useState(order.time);

  const act = async (path, body = {}, message) => {
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/takeaway/orders/${order.id}/${path}`, { method: 'POST', body });
      showToast(message, 'success');
      setMode(null);
      await onChanged(res);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const status = STATUS[shownStatus(order)];
  const open = ['requested', 'accepted'].includes(order.status);
  const telHref = order.phone ? `tel:${order.phone.replace(/[^\d+]/g, '')}` : null;

  const footer = order.status === 'requested' ? (
    mode === 'reject' ? (
      <div className="space-y-2">
        <input className={input} autoFocus placeholder="Motivo (facoltativo)" maxLength={200} value={reason} onChange={e => setReason(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && act('reject', { reason }, 'Ordine rifiutato')} />
        <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setMode(null)}>Indietro</button><button className={btnDanger} disabled={busy} onClick={() => act('reject', { reason }, 'Ordine rifiutato')}>Rifiuta</button></div>
      </div>
    ) : (
      <div className="space-y-2">
        {slots.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">Ritiro alle
            <select className={`${input} !w-28 !h-10`} value={time} onChange={e => setTime(e.target.value)} aria-label="Orario di ritiro">
              {[...new Set([order.time, ...slots.map(s => s.time)])].sort().map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className={btn} disabled={busy} onClick={() => setMode('reject')}>Rifiuta</button>
          <button className={btnPrimary} disabled={busy} onClick={() => act('accept', time !== order.time ? { time } : {}, 'Ordine accettato: va in cucina')}>Accetta</button>
        </div>
      </div>
    )
  ) : order.status === 'accepted' ? (
    mode === 'pay' ? (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-muted)]">Incassa <span className="text-lg font-semibold text-[var(--text-main)] tabular-nums">{formatEuro(order.total)}</span></p>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map(m => {
            const Icon = m[2];
            return <button key={m[0]} className={`${btn} flex-col !h-16 gap-1`} disabled={busy} onClick={() => act('picked-up', { method: m[0] }, 'Consegnato e incassato')}><Icon size={18} />{m[1]}</button>;
          })}
        </div>
        <button className="text-sm text-[var(--text-muted)] cursor-pointer" onClick={() => setMode(null)}>Indietro</button>
      </div>
    ) : mode === 'cancel' ? (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-main)]">Annullare l'ordine? Va tolto dalla cucina e i prodotti tornano disponibili.</p>
        <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setMode(null)}>No</button><button className={btnDanger} disabled={busy} onClick={() => act('cancel', {}, 'Ordine annullato')}>Sì, annulla</button></div>
      </div>
    ) : (
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button className={btn} disabled={busy} onClick={() => setMode('cancel')}>Annulla</button>
        <button className={btnPrimary} disabled={busy} onClick={() => setMode('pay')}>Consegna e incassa · {formatEuro(order.total)}</button>
      </div>
    )
  ) : null;

  return (
    <PanelFrame title={order.customer_name} subtitle={`${formatDay(order.date, { short: true })} · ritiro ${order.time}${order.display_code ? ` · ${order.display_code}` : ''}`} onBack={onBack} footer={footer}>
      <div className="px-1 space-y-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium ${TONES[status.tone]}`}>{status.label}</span>
          <span className="text-sm text-[var(--text-muted)]">{SOURCE[order.source] ?? order.source}</span>
          {order.paid_method && <span className="text-sm text-[var(--text-muted)]">· pagato {({ cash: 'in contanti', card: 'con carta', other: 'altro' })[order.paid_method]}</span>}
        </div>

        <ul className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {order.items.map((i, n) => (
            <li key={n} className="flex items-start gap-3 px-3 py-2.5 bg-[var(--bg-card-2)]">
              <span className="w-7 text-center font-semibold tabular-nums text-[var(--text-main)]">{i.quantity}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[var(--text-main)]">{i.name}</span>
                {i.note && <span className="block text-xs text-amber-500">{i.note}</span>}
              </span>
              <span className="text-sm tabular-nums text-[var(--text-muted)]">{formatEuro(i.line_total)}</span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2.5 bg-[var(--bg-card)]"><span className="text-sm font-medium text-[var(--text-main)]">Totale</span><span className="font-semibold tabular-nums text-[var(--text-main)]">{formatEuro(order.total)}</span></li>
        </ul>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-[var(--text-muted)] flex items-center gap-1.5"><Clock size={14} />Ritiro</dt><dd className="text-[var(--text-main)] font-medium">{order.time}</dd>
          <dt className="text-[var(--text-muted)] flex items-center gap-1.5"><Phone size={14} />Telefono</dt>
          <dd className="text-[var(--text-main)]">{order.phone ? <a className="text-[var(--accent)] font-medium" href={telHref}>{order.phone}</a> : '—'}</dd>
          {order.notes && <><dt className="text-[var(--text-muted)] flex items-center gap-1.5"><StickyNote size={14} />Note</dt><dd className="text-[var(--text-main)]">{order.notes}</dd></>}
          {order.reject_reason && <><dt className="text-[var(--text-muted)] flex items-center gap-1.5"><X size={14} />Motivo</dt><dd className="text-[var(--text-main)]">{order.reject_reason}</dd></>}
        </dl>
        <WhatsAppStatus refType="takeaway" refId={order.id} version={order.status + (order.ready ? 'r' : '')} />
        {!open && order.status === 'picked_up' && <p className="text-sm text-[var(--text-muted)]">Ordine concluso.</p>}
      </div>
    </PanelFrame>
  );
};

export default OrderPanel;
