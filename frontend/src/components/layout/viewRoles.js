// Quali pagine vede un utente: dipende dal ruolo e dai moduli accesi per il suo locale. Vale per il menu laterale
// e per le route: nascondere la voce non basta, perché l'URL (o la PWA riaperta sull'ultima pagina) porterebbe
// comunque lì. Le autorizzazioni vere sono sul server (ruoli e requireModule).
const VIEW_ROLES = {
  dashboard: ['admin', 'manager', 'cashier'],
  kitchen: ['admin', 'kitchen'],
  takeaway: ['admin', 'manager', 'cashier'],
  statistics: ['admin', 'manager'],
  config: ['admin'],
  inventory: ['admin', 'manager'],
  setup: ['admin', 'manager', 'cashier'],
};

// Pagine che dipendono da un modulo; le altre fanno parte del nucleo e ci sono sempre.
const VIEW_MODULES = {
  kitchen: 'kds',
  takeaway: 'takeaway',
  statistics: 'stats',
  inventory: 'inventory',
};

// `modules` mancante = utente salvato prima dei moduli (cache offline): non si nasconde nulla finché il
// server non risponde con l'elenco aggiornato.
export const canView = (role, view, modules, inventory) => {
  if (!VIEW_ROLES[view]?.includes(role)) return false;
  if (view === 'inventory' && inventory?.mode !== 'warehouse') return false;   // ingredienti e ricette solo nella modalità «magazzino»
  const required = VIEW_MODULES[view];
  return !required || !modules || modules.includes(required);
};

// Prima pagina disponibile per questo utente, o null se non ne ha nessuna (es. cucina senza il modulo KDS).
export const defaultView = (role, modules, inventory) =>
  ['dashboard', 'kitchen', 'statistics', 'setup', 'config'].find(view => canView(role, view, modules, inventory)) ?? null;
