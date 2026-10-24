import { useState, useEffect, useRef } from 'react';
import { Bell, CalendarPlus, CalendarX2, CheckCheck, ShoppingBag } from 'lucide-react';
import { formatDay } from '../reservations/rules';

// La campanella in testata: il numero di cose da fare e, al tocco, l'elenco. Ogni voce porta direttamente alla
// prenotazione da approvare. Si chiude toccando fuori o con Esc.
const KIND = {
  request: { icon: CalendarPlus, title: (i) => `Nuova richiesta · ${i.customer_name}`, tone: 'text-amber-500 bg-amber-500/15' },
  cancel_request: { icon: CalendarX2, title: (i) => `Chiede di annullare · ${i.customer_name}`, tone: 'text-red-500 bg-red-500/15' },
  takeaway_request: { icon: ShoppingBag, title: (i) => `Ordine da asporto · ${i.customer_name}`, tone: 'text-[var(--accent)] bg-[var(--accent)]/15' },
};

const NotificationBell = ({ items, onOpen }) => {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={items.length ? `Notifiche: ${items.length} da vedere` : 'Notifiche'} aria-expanded={open} aria-haspopup="true"
        className="relative h-9 w-9 coarse:h-11 coarse:w-11 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold tabular-nums flex items-center justify-center">{items.length > 9 ? '9+' : items.length}</span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Notifiche" className="absolute right-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-main)]">Notifiche</p>
            {items.length > 0 && <p className="text-xs text-[var(--text-muted)]">{items.length} da gestire</p>}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--text-muted)]">
              <CheckCheck size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tutto a posto: niente da approvare.</p>
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)]">
              {items.map(i => {
                const k = KIND[i.kind] ?? KIND.request;
                const Icon = k.icon;
                return (
                  <li key={`${i.kind}-${i.id}`}>
                    <button role="menuitem" onClick={() => { setOpen(false); onOpen(i); }} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--bg-card-2)] cursor-pointer">
                      <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${k.tone}`}><Icon size={16} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--text-main)] truncate">{k.title(i)}</span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          {i.kind === 'takeaway_request'
                            ? `Ritiro ${formatDay(i.date, { short: true })} alle ${i.start_time} · ${Number(i.total).toFixed(2).replace('.', ',')} €`
                            : `${formatDay(i.date, { short: true })} · ${i.start_time} · ${i.party_size} ${i.party_size === 1 ? 'persona' : 'persone'}`}
                        </span>
                        <span className="block text-xs text-[var(--accent)] mt-0.5">{i.kind === 'cancel_request' ? 'Tocca per decidere sull\'annullo' : 'Tocca per approvare o rifiutare'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
