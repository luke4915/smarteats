import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import ServiceControl from './ServiceControl';
import NotificationBell from '../notifications/NotificationBell';

// La testata di SmartEats: a sinistra nome del locale e servizio in corso; a destra apertura/chiusura del servizio,
// notifiche (solo per chi gestisce le prenotazioni), chi è collegato, tema e uscita. L'account si modifica da
// Impostazioni → Il mio account, non da qui.
const AppHeader = ({ user, service, canManageService, serviceActions, inbox, onOpenNotification, theme, onToggleTheme, onLogout }) => (
  <header className="flex items-center justify-between gap-3 px-4 mt-3 mb-1 shrink-0">
    <div className="min-w-0">
      <p className="text-xs text-[var(--text-muted)] truncate">SmartEats{service ? ` / ${service.name}` : ''}</p>
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-main)] leading-tight truncate">{user.tenantName}</h1>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <ServiceControl service={service} canManage={canManageService} {...serviceActions} />
      <div className="flex items-center gap-0.5">
        {inbox && <NotificationBell items={inbox.items} onOpen={onOpenNotification} />}
        <span className="flex items-center gap-2 h-9 px-2.5 text-[var(--text-main)]" title={user.username}>
          <UserRound size={16} /><span className="hidden sm:inline text-xs font-semibold">{user.username}</span>
        </span>
        <button onClick={onToggleTheme} aria-label="Cambia tema" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card-2)] text-[var(--text-muted)] cursor-pointer">
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={onLogout} aria-label="Esci" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-500 cursor-pointer"><LogOut size={16} /></button>
      </div>
    </div>
  </header>
);

export default AppHeader;
