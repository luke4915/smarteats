import { NavLink } from 'react-router-dom';

// Il menu di navigazione di SmartEats e della cassa delle sagre: laterale su schermo largo (con le etichette da `xl`), barra in basso su
// telefono e tablet piccoli. Le voci ({ id, label }) arrivano già filtrate per ruolo e moduli; `icons` dà l'icona di ogni id.
const LINK_CLASS = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
  ${isActive ? 'bg-[var(--bg-card-2)] text-[var(--text-main)] [&>svg]:text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-main)]'}`;

const NavItem = ({ view, icons, compact, badge }) => {
  const Icon = icons[view.id];
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

export const SideNav = ({ views, icons, brand, badges = {} }) => (
  <aside className={`${views.length > 1 ? 'hidden md:flex' : 'hidden'} flex-col shrink-0 w-20 xl:w-60 bg-[var(--bg-card)] border-r border-[var(--border)] py-5 px-3 gap-6 overflow-y-auto no-scrollbar [@media(max-height:520px)]:py-2 [@media(max-height:520px)]:gap-2`}>
    <div className="flex items-center gap-3 px-1">
      <div className="w-9 h-9 shrink-0 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white font-semibold text-lg select-none">S</div>
      <span className="hidden xl:inline font-semibold text-base tracking-tight text-[var(--text-main)]">{brand}</span>
    </div>
    <nav className="flex-1 space-y-1 [@media(max-height:520px)]:space-y-0">{views.map(v => <NavItem key={v.id} view={v} icons={icons} badge={badges[v.id]} />)}</nav>
  </aside>
);

export const BottomNav = ({ views, icons, badges = {} }) => views.length > 1 && (
  <nav className="md:hidden flex justify-around gap-1 px-2 py-2 bg-[var(--bg-card)] border-t border-[var(--border)] shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
    {views.map(v => <NavItem key={v.id} view={v} icons={icons} compact badge={badges[v.id]} />)}
  </nav>
);
