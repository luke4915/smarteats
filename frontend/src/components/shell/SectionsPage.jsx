import { useSearchParams } from 'react-router-dom';
import { PageHeader, PageBody } from '../shared/PageHeader';

// La pagina delle Impostazioni di SmartEats e della cassa delle sagre: un menu di sezioni a sinistra (a righe scorrevoli
// sul telefono) e una sola sezione alla volta. La sezione è nell'indirizzo (?sezione=…), così un ricarica riporta dove si era.
//   sections  [{ id, label, hint }] già filtrate per ruolo e moduli
//   content   { [id]: () => <Sezione /> }
const SectionsPage = ({ title = 'Impostazioni', sections, content }) => {
  const [params, setParams] = useSearchParams();
  const current = sections.find(s => s.id === params.get('sezione')) ?? sections[0];
  const open = (id) => setParams({ sezione: id }, { replace: true });
  const Content = content[current.id];

  return (
    <PageBody>
      <PageHeader title={title} subtitle={current.hint} />
      <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-start">
        <nav aria-label="Sezioni delle impostazioni" className="w-full md:w-52 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar md:sticky md:top-0">
          {sections.map(s => (
            <button key={s.id} onClick={() => open(s.id)} aria-current={s.id === current.id ? 'page' : undefined}
              className={`shrink-0 text-left px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap
                ${s.id === current.id ? 'bg-[var(--bg-card-2)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-main)]'}`}>
              {s.label}
            </button>
          ))}
        </nav>
        <div key={current.id} className="motion-panel flex-1 min-w-0 w-full space-y-6"><Content /></div>
      </div>
    </PageBody>
  );
};

export default SectionsPage;
