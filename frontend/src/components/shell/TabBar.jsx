import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import Modal from '../shared/Modal';

// La barra delle schede sul telefono, come quella di iOS: icona e nome sotto, la pagina aperta in colore d'accento, vetro
// sfocato. Fino a cinque voci stanno tutte in barra; con più voci le prime quattro restano e le altre vanno sotto «Altro»
// (un foglio con l'elenco). I numeri rossi (da gestire) di una voce nascosta si sommano su «Altro».
const MAX_TABS = 5;
const tab = (on) => `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 min-h-[52px] text-[10px] font-medium transition-colors cursor-pointer ${on ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`;

const Badge = ({ count }) => count > 0 && (
  <span className="absolute -top-1 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums flex items-center justify-center">{count > 9 ? '9+' : count}</span>
);

const TabBar = ({ views, icons, badges = {} }) => {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  if (views.length < 2) return null;

  const overflow = views.length > MAX_TABS;
  const shown = overflow ? views.slice(0, MAX_TABS - 1) : views;
  const hidden = overflow ? views.slice(MAX_TABS - 1) : [];
  const hiddenBadge = hidden.reduce((sum, v) => sum + (badges[v.id] ?? 0), 0);

  return (
    <nav aria-label="Pagine" className="md:hidden flex shrink-0 border-t border-[var(--border)]/70 bg-[var(--bg-card)]/85 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {shown.map(v => {
        const Icon = icons[v.id];
        return (
          <NavLink key={v.id} to={`/${v.id}`} className={({ isActive }) => tab(isActive)}>
            <span className="relative"><Icon size={22} /><Badge count={badges[v.id]} /></span>
            <span className="max-w-full truncate px-0.5">{v.label}</span>
          </NavLink>
        );
      })}
      {overflow && (
        <button type="button" className={tab(hidden.some(v => pathname === `/${v.id}`))} onClick={() => setMore(true)}>
          <span className="relative"><MoreHorizontal size={22} /><Badge count={hiddenBadge} /></span>
          <span>Altro</span>
        </button>
      )}
      {more && (
        <Modal title="Altro" onClose={() => setMore(false)}>
          <ul className="-mx-2 divide-y divide-[var(--border)]">
            {hidden.map(v => {
              const Icon = icons[v.id];
              return (
                <li key={v.id}>
                  <NavLink to={`/${v.id}`} onClick={() => setMore(false)}
                    className={({ isActive }) => `flex items-center gap-3 px-2 py-3.5 text-base font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>
                    <Icon size={22} className="shrink-0" />
                    <span className="flex-1">{v.label}</span>
                    {badges[v.id] > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold tabular-nums flex items-center justify-center">{badges[v.id]}</span>}
                    <ChevronRight size={18} className="text-[var(--text-muted)]" />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </nav>
  );
};

export default TabBar;
