import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import NotificationBell from '../../smarteats/notifications/NotificationBell';

// La testata di SmartEats e della cassa delle sagre: a sinistra il nome del locale; a destra il servizio in corso
// (`serviceControl`, un solo punto: apre e chiude), lo stato di rete e stampa (`status`, solo la cassa), le notifiche, chi è collegato, tema e uscita. L'account si modifica da
// Impostazioni → Il mio account, non da qui.
const AppHeader = ({ user, serviceControl, status, inbox, onOpenNotification, theme, onToggleTheme, onLogout }) => (
  <header className="flex items-center justify-between gap-3 px-4 mt-3 mb-1 shrink-0">
    <div className="min-w-0">
      <h1 className="text-base sm:text-xl font-semibold tracking-tight text-[var(--text-main)] leading-tight line-clamp-2 break-words">{user.tenantName}</h1>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {serviceControl}
      {status}
      <div className="flex items-center gap-0.5">
        {inbox && <NotificationBell items={inbox.items} onOpen={onOpenNotification} />}
        <span className="flex items-center gap-2 h-9 coarse:h-11 px-2.5 text-[var(--text-main)]" title={user.username}>
          <UserRound size={16} /><span className="hidden sm:inline text-xs font-semibold">{user.username}</span>
        </span>
        <button onClick={onToggleTheme} aria-label="Cambia tema" className="h-9 w-9 coarse:h-11 coarse:w-11 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card-2)] text-[var(--text-muted)] cursor-pointer">
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={onLogout} aria-label="Esci" className="h-9 w-9 coarse:h-11 coarse:w-11 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-500 cursor-pointer"><LogOut size={16} /></button>
      </div>
    </div>
  </header>
);

export default AppHeader;
