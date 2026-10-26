// La scheda di una pagina di lavoro. Da tablet in su è un riquadro sul fondo dell'app; sul telefono non c'è nessun riquadro:
// la pagina occupa tutto lo schermo, come in un'app di iPhone (il margine ai lati lo dà il contenitore).
const PageCard = ({ className = '', children }) => (
  <div className={`flex-1 min-w-0 overflow-y-auto no-scrollbar md:bg-[var(--bg-card)] md:rounded-xl md:border md:border-[var(--border)] md:p-6 ${className}`}>{children}</div>
);

export default PageCard;
