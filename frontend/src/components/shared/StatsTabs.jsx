import { useState, lazy, Suspense } from 'react';
import Segmented from '../../smarteats/floor/Segmented';
import { PageHeader, PageBody } from './PageHeader';
import { useAuth } from '../../context/useAuth';
import { canViewInventoryStats } from '../layout/viewRoles';
import Loading from './Loading';

const ReportPanel = lazy(() => import('../../inventory/ReportPanel'));

// Statistiche: le vendite (la pagina del locale) e, dove c'è il magazzino con gli ingredienti, la scheda «Magazzino» con costi,
// margini, scarti e acquisti. Tutte le statistiche stanno qui; senza magazzino compare solo la pagina delle vendite, senza schede.
// `children` è la pagina delle vendite (diversa per sagre e ristoranti).
const StatsTabs = ({ children }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('sales');
  if (!canViewInventoryStats(user.role, user.modules, user.inventory)) return children;
  const dish = user.businessType === 'street_food' ? 'prodotto' : 'piatto';

  return (
    <div className="space-y-5">
      <div className="max-w-5xl mx-auto w-full">
        <Segmented label="Tipo di statistiche" className="w-fit" value={tab} onChange={setTab} options={[{ id: 'sales', label: 'Vendite' }, { id: 'inventory', label: 'Magazzino' }]} />
      </div>
      {tab === 'sales' ? children : (
        <PageBody>
          <PageHeader title="Magazzino" subtitle="Quanto costa ciò che vendi, cosa si perde e quanto spendi con i fornitori." />
          <Suspense fallback={<Loading />}><ReportPanel dish={dish} /></Suspense>
        </PageBody>)}
    </div>
  );
};

export default StatsTabs;
