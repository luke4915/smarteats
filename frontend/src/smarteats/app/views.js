// Pagine dell'app SmartEats (ristoranti e pizzerie): chi le vede dipende dal ruolo e dai moduli del locale.
// Come in components/layout/viewRoles.js, vale per il menu e per le route; le autorizzazioni vere sono sul server.
import { settingsSections } from '../settings/sections.js';

const VIEWS = [
  { id: 'floor', label: 'Sala', roles: ['admin', 'manager', 'cashier', 'waiter'], module: 'tables' },
  { id: 'reservations', label: 'Prenotazioni', roles: ['admin', 'manager', 'cashier', 'waiter'], module: 'bookings' },
  { id: 'takeaway', label: 'Asporto', roles: ['admin', 'manager', 'cashier', 'waiter'], module: 'takeaway' },
  { id: 'kitchen', label: 'Cucina', roles: ['admin', 'kitchen'], module: 'kds' },
  { id: 'catalog', label: 'Carta', roles: ['admin'] },
  { id: 'inventory', label: 'Magazzino', roles: ['admin', 'manager'], module: 'inventory', warehouse: true },
  { id: 'stats', label: 'Statistiche', roles: ['admin', 'manager'], module: 'stats' },
  { id: 'settings', label: 'Impostazioni', roles: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'], needsSections: true },
];

// `modules` mancante = utente salvato in cache offline: non si nasconde nulla finché il server non risponde.
// Le Impostazioni si vedono solo se per quel ruolo c'è almeno una sezione (la cucina, per esempio, non ne ha).
export const visibleViews = (role, modules, inventory) =>
  VIEWS.filter(v => v.roles.includes(role)
    && (!v.module || !modules || modules.includes(v.module))
    && (!v.warehouse || inventory?.mode === 'warehouse')                  // il magazzino con ingredienti esiste solo nella modalità «magazzino»
    && (!v.needsSections || !modules || settingsSections({ role, modules }).length > 0));

export const canViewSmartEats = (role, viewId, modules, inventory) => visibleViews(role, modules, inventory).some(v => v.id === viewId);

// Prima pagina disponibile, o null se il ruolo non ne ha (es. cucina senza il modulo KDS).
export const smartEatsHome = (role, modules, inventory) => visibleViews(role, modules, inventory)[0]?.id ?? null;

// Ristoranti e attività di solo asporto usano questa app (i moduli accesi decidono quali pagine vedono); le sagre e i paninari usano quella della cassa.
export const usesSmartEats = (user) => ['restaurant', 'takeaway_shop'].includes(user?.businessType);
