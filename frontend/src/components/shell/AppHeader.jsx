import NotificationBell from '../../smarteats/notifications/NotificationBell';
import AccountMenu from './AccountMenu';

// La testata di SmartEats e della cassa delle sagre. A sinistra: sul telefono il nome della pagina (come la barra di un'app di iPhone),
// altrove il nome del locale. A destra: il servizio in corso (`serviceControl`, un solo punto: apre e chiude), lo stato di rete e stampa
// (`status`, solo la cassa), le notifiche e l'account (iniziali, aspetto, uscita).
const AppHeader = ({ user, title, serviceControl, status, inbox, onOpenNotification, theme, onThemeChange, onLogout }) => (
  <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 md:mb-1 shrink-0">
    <h1 className="min-w-0 text-xl font-semibold tracking-tight text-[var(--text-main)] leading-tight line-clamp-2 break-words">
      <span className="md:hidden">{title ?? user.tenantName}</span>
      <span className="hidden md:inline">{user.tenantName}</span>
    </h1>
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {serviceControl}
      {status}
      {inbox && <NotificationBell items={inbox.items} onOpen={onOpenNotification} />}
      <AccountMenu user={user} theme={theme} onThemeChange={onThemeChange} onLogout={onLogout} />
    </div>
  </header>
);

export default AppHeader;
