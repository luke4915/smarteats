import { Clock } from 'lucide-react';
import { ticketMeta } from './board';

// Una comanda sul tabellone della cucina: testata colorata dall'attesa (verde, ambra, rossa), il codice da chiamare grande, dove va
// (tavolo, asporto con l'orario di ritiro, banco) e i piatti con opzioni e note evidenziate. Solo lettura, nessun prezzo.
const HEAD = { ok: 'bg-emerald-600 text-white', warn: 'bg-amber-500 text-neutral-950', late: 'bg-red-600 text-white' };
const clock = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const TicketCard = ({ order, now }) => {
  const { level, minutes, where, code } = ticketMeta(order, now);
  return (
    <article className="flex flex-col rounded-2xl overflow-hidden bg-neutral-900 ring-1 ring-white/10" aria-label={`Comanda ${code}`}>
      <header className={`px-4 py-3 flex items-start justify-between gap-3 ${HEAD[level]}`}>
        <div className="min-w-0">
          <h3 className="text-3xl font-semibold leading-none tabular-nums">{code}</h3>
          <p className="mt-1.5 text-sm font-medium opacity-90 truncate">
            {where}{order.pickup_at && ` · ritiro ${clock(order.pickup_at)}`}{order.course_name && ` · ${order.course_name}`}
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-lg font-semibold tabular-nums"><Clock size={16} />{minutes}<span className="text-sm font-medium">min</span></span>
      </header>
      <ul className="p-3 space-y-2.5">
        {order.items?.map((item, n) => (
          <li key={n} className="flex gap-3 items-baseline">
            <span className="w-8 shrink-0 text-right text-2xl font-semibold tabular-nums text-white">{item.quantity}</span>
            <span className="min-w-0 text-xl leading-snug text-white">
              {item.name}
              {item.modifiers?.length > 0 && <span className="block text-base text-neutral-400">{item.modifiers.join(', ')}</span>}
              {item.note && <span className="mt-1 block w-fit rounded-md bg-amber-400 px-2 py-0.5 text-base font-semibold text-neutral-950">{item.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
};

export default TicketCard;
