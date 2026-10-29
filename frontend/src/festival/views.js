// Le pagine della cassa delle sagre e dei paninari: nome nel menu e icona. Chi le vede lo decide `canView`
// (ruolo e moduli accesi, in components/layout/viewRoles.js); qui c'è solo l'elenco e l'ordine delle voci.
import { canView } from '../components/layout/viewRoles';

const VIEWS = [
  { id: 'dashboard', label: 'Cassa' },
  { id: 'takeaway', label: 'Asporto' },
  { id: 'kitchen', label: 'Cucina' },
  { id: 'statistics', label: 'Statistiche' },
  { id: 'config', label: 'Menu' },
  { id: 'inventory', label: 'Magazzino' },
  { id: 'setup', label: 'Impostazioni' },
];

export const festivalViews = (role, modules, inventory) => VIEWS.filter(v => canView(role, v.id, modules, inventory));
