import { X } from 'lucide-react';
import { iconBtn } from '../../smarteats/floor/ui';

// Una riga di suggerimento discreta (un gesto che non si vede, per esempio), con la X per toglierla. Lo stato lo tiene `useOnceHint`.
const Hint = ({ children, onDismiss }) => (
  <div role="note" className="flex items-center gap-2 pl-3 pr-1 py-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] text-xs text-[var(--text-muted)]">
    <span className="flex-1 min-w-0">{children}</span>
    <button type="button" onClick={onDismiss} aria-label="Nascondi il suggerimento" className={`${iconBtn} shrink-0`}><X size={14} /></button>
  </div>
);

export default Hint;
