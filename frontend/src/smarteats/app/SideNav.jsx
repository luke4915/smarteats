import { NavLink } from 'react-router-dom';
import { LayoutGrid, CalendarDays, UtensilsCrossed, BookOpen, BarChart3, Settings, ShoppingBag } from 'lucide-react';

// Il menu di navigazione di SmartEats: laterale su schermo largo (con le etichette da `xl`), barra in basso su
// telefono e tablet piccoli. Le voci arrivano da `views.js`, già filtrate per ruolo e moduli.
const ICONS = { floor: LayoutGrid, reservations: CalendarDays, takeaway: ShoppingBag, kitchen: UtensilsCrossed, catalog: BookOpen, stats: BarChart3, settings: Settings };
const LINK_CLASS = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
  ${isActive ? 'bg-[var(--bg-card-2)] text-[var(--text-main)] [&>svg]:text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-main)]'}`;

const NavItem = ({ view, compact, badge }) => {
  const Icon = ICONS[view.id];
  return (
    <NavLink to={`/${view.id}`} className={LINK_CLASS} title={view.label}>
      <span className="relative shrink-0">
        <Icon size={20} />
        {badge > 0 && <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
      </span>
      <span className={compact ? 'sr-only' : 'hidden xl:inline'}>{view.label}</span>
    </NavLink>
  );
};

export const SideNav = ({ views, badges = {} }) => (
  <aside className={`${views.length > 1 ? 'hidden md:flex' : 'hidden'} flex-col shrink-0 w-20 xl:w-60 bg-[var(--bg-card)] border-r border-[var(--border)] py-5 px-3 gap-6`}>
    <div className="flex items-center gap-3 px-1">
      <div className="w-9 h-9 shrink-0 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white font-semibold text-lg select-none">S</div>
      <span className="hidden xl:inline font-semibold text-base tracking-tight text-[var(--text-main)]">SmartEats</span>
    </div>
    <nav className="flex-1 space-y-1">{views.map(v => <NavItem key={v.id} view={v} badge={badges[v.id]} />)}</nav>
  </aside>
);

export const BottomNav = ({ views, badges = {} }) => views.length > 1 && (
  <nav className="md:hidden flex justify-around gap-1 px-2 py-2 bg-[var(--bg-card)] border-t border-[var(--border)] shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
    {views.map(v => <NavItem key={v.id} view={v} compact badge={badges[v.id]} />)}
  </nav>
);
