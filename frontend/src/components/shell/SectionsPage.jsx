import { useSearchParams } from 'react-router-dom';
import { PageHeader, PageBody } from '../shared/PageHeader';
import Segmented from '../../smarteats/floor/Segmented';

// La pagina delle Impostazioni di SmartEats e della cassa delle sagre: le sezioni sono tile in alto (le stesse delle sale e
// delle altre viste, che scorrono se non ci stanno) e sotto c'è una sola sezione alla volta. La sezione è nell'indirizzo
// (?sezione=…), così un ricarica riporta dove si era. Con una sola sezione le tile non si mostrano.
//   sections  [{ id, label, hint }] già filtrate per ruolo e moduli
//   content   { [id]: () => <Sezione /> } (funzioni che restituiscono la sezione: si chiamano, non si montano come componenti, così
//             un nuovo disegno della pagina non ricrea la sezione e non ne perde lo stato, per esempio l'editor della pianta aperto)
const SectionsPage = ({ title = 'Impostazioni', sections, content }) => {
  const [params, setParams] = useSearchParams();
  const current = sections.find(s => s.id === params.get('sezione')) ?? sections[0];
  const open = (id) => setParams({ sezione: id }, { replace: true });

  return (
    <PageBody>
      <PageHeader title={title} subtitle={current.hint} />
      {sections.length > 1 && (
        <Segmented scroll label="Sezioni delle impostazioni" className="w-fit max-w-full" value={current.id} onChange={open}
          options={sections.map(s => ({ id: s.id, label: s.label }))} />
      )}
      <div key={current.id} className="motion-panel min-w-0 w-full space-y-6">{content[current.id]()}</div>
    </PageBody>
  );
};

export default SectionsPage;
