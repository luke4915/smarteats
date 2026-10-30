import { Check, Clock, X } from 'lucide-react';

// Il simbolo tondo dell'esito di una richiesta, nelle pagine dei clienti (prenotazione e asporto): spunta verde se è andata
// bene, X rossa se non è andata a buon fine (rifiutata, annullata, scaduta, non presentati), orologio mentre si aspetta il locale.
const TONES = {
  good: { Icon: Check, className: 'bg-green-500/15 text-green-500' },
  bad: { Icon: X, className: 'bg-red-500/15 text-red-500' },
  waiting: { Icon: Clock, className: 'bg-[var(--accent)]/15 text-[var(--accent)]' },
};

const StatusMark = ({ tone }) => {
  const { Icon, className } = TONES[tone] ?? TONES.waiting;
  return <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${className}`}><Icon size={18} /></span>;
};

export default StatusMark;
