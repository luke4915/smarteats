import { useState } from 'react';
import { LogOut, MessageSquarePlus } from 'lucide-react';
import { usePopover } from '../../hooks/usePopover';
import { roleLabel } from '../shared/roles';
import ThemeChoice from './ThemeChoice';
import FeedbackModal from '../shared/FeedbackModal';
import { label, popover } from '../../smarteats/floor/ui';

// L'account in testata: un solo pulsante (le iniziali) che apre chi è collegato, la scelta dell'aspetto, i suggerimenti (per chi gestisce
// il locale: admin e responsabile) e l'uscita. Profilo e utenti si gestiscono da Impostazioni → Account, non da qui.
const CAN_SUGGEST = ['admin', 'manager'];
const AccountMenu = ({ user, theme, onThemeChange, onLogout }) => {
  const { open, ref, toggle, close } = usePopover();
  const [feedback, setFeedback] = useState(false);
  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label={`Account: ${user.username}`} aria-haspopup="true" aria-expanded={open}
        className="flex items-center gap-2 h-9 coarse:h-11 pl-0.5 sm:pr-3 rounded-full hover:bg-[var(--bg-card-2)] transition cursor-pointer">
        <span className="w-8 h-8 coarse:w-10 coarse:h-10 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-semibold flex items-center justify-center select-none">{user.username.slice(0, 2).toUpperCase()}</span>
        <span className="hidden sm:inline text-sm font-medium text-[var(--text-main)] max-w-28 truncate">{user.username}</span>
      </button>
      {open && (
        <div role="group" aria-label="Account" className={`${popover} absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)]`}>
          <div className="px-4 pt-3.5 pb-3">
            <p className="text-sm font-semibold text-[var(--text-main)] truncate">{user.username}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{roleLabel(user.role)} · {user.tenantName}</p>
          </div>
          <div className="px-4 pb-3.5 space-y-1.5">
            <p className={label}>Aspetto</p>
            <ThemeChoice value={theme} onChange={onThemeChange} />
          </div>
          <div className="border-t border-[var(--border)] p-1.5">
            {CAN_SUGGEST.includes(user.role) && (
              <button onClick={() => { close(); setFeedback(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 coarse:py-3 rounded-lg text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-card-2)] transition cursor-pointer">
                <MessageSquarePlus size={16} className="shrink-0 text-[var(--text-muted)]" /> Suggerimenti
              </button>
            )}
            <button onClick={() => { close(); onLogout(); }} className="w-full flex items-center gap-3 px-3 py-2.5 coarse:py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition cursor-pointer">
              <LogOut size={16} className="shrink-0" /> Esci
            </button>
          </div>
        </div>
      )}
      {feedback && <FeedbackModal businessType={user.businessType} onClose={() => setFeedback(false)} />}
    </div>
  );
};

export default AccountMenu;
