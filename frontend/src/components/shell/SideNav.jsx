import { NavLink } from 'react-router-dom';

// Il menu laterale di SmartEats e della cassa delle sagre (da tablet in su; con le etichette da `xl`). Sul telefono c'è `TabBar`.
// Le voci ({ id, label }) arrivano già filtrate per ruolo e moduli; `icons` dà l'icona di ogni id.
// Ogni voce è alta almeno 44 px (bersaglio da dito). Nella barra stretta (solo icone) l'icona sta al centro, con le etichette a sinistra.
const linkClass = ({ isActive }) => `flex items-center justify-center xl:justify-start gap-3 px-3 py-2.5 min-h-11 rounded-lg transition-colors text-sm font-medium
  ${isActive ? 'bg-[var(--bg-card-2)] text-[var(--text-main)] [&_svg]:text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-main)]'}`;

const NavItem = ({ view, icons, badge }) => {
  const Icon = icons[view.id];
  return (
    <NavLink to={`/${view.id}`} className={linkClass} title={view.label}>
      <span className="relative shrink-0">
        <Icon size={20} />
        {badge > 0 && <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
      </span>
      <span className="hidden xl:inline">{view.label}</span>
    </NavLink>
  );
};

const SideNav = ({ views, icons, brand, badges = {} }) => (
  <aside className={`${views.length > 1 ? 'hidden md:flex' : 'hidden'} flex-col shrink-0 w-[4.5rem] xl:w-56 bg-[var(--bg-card)] border-r border-[var(--border)] py-5 px-3 gap-6 overflow-y-auto no-scrollbar [@media(max-height:520px)]:py-2 [@media(max-height:520px)]:gap-2`}>
    <div className="flex items-center justify-center xl:justify-start gap-3 xl:px-1">
      <div className="w-9 h-9 shrink-0 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white font-semibold text-lg select-none">S</div>
      <span className="hidden xl:inline font-semibold text-base tracking-tight text-[var(--text-main)]">{brand}</span>
    </div>
    <nav aria-label="Pagine" className="flex-1 space-y-1 [@media(max-height:520px)]:space-y-0">{views.map(v => <NavItem key={v.id} view={v} icons={icons} badge={badges[v.id]} />)}</nav>
  </aside>
);

export default SideNav;
