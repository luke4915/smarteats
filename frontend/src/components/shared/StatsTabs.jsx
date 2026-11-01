import { useState, lazy, Suspense } from 'react';
import Segmented from './Segmented';
import { PageHeader, PageBody } from './PageHeader';
import { useAuth } from '../../context/useAuth';
import { canViewInventoryStats } from '../layout/viewRoles';
import Loading from './Loading';
import { termsFor } from '../../utils/terms';

const ReportPanel = lazy(() => import('../../modules/inventory/ReportPanel'));
const CompareSessions = lazy(() => import('../../modules/stats/CompareSessions'));
const MenuMatrix = lazy(() => import('../../modules/stats/MenuMatrix'));

// Statistiche: le vendite (la pagina del locale), il confronto tra due serate, la matrice del menu e, dove c'è il magazzino con gli
// ingredienti, la scheda «Magazzino» con costi, margini, scarti e acquisti. Tutte le statistiche stanno qui, uguali per sagre e ristoranti.
// `children` è la pagina delle vendite (diversa per sagre e ristoranti).
const StatsTabs = ({ children }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('sales');
  const dish = user.businessType === 'street_food' ? 'prodotto' : 'piatto';
  const compareLabel = termsFor(user.businessType).unit === 'serata' ? 'Confronto serate' : 'Confronto servizi';
  const tabs = [
    { id: 'sales', label: 'Vendite' }, { id: 'compare', label: compareLabel }, { id: 'menu', label: 'Menu' },
    ...(canViewInventoryStats(user.role, user.modules, user.inventory) ? [{ id: 'inventory', label: 'Magazzino' }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="max-w-5xl mx-auto w-full">
        <Segmented scroll label="Tipo di statistiche" className="w-fit max-w-full" value={tab} onChange={setTab} options={tabs} />
      </div>
      {tab === 'sales' && children}
      {tab === 'compare' && <Suspense fallback={<Loading />}><CompareSessions /></Suspense>}
      {tab === 'menu' && <Suspense fallback={<Loading />}><MenuMatrix /></Suspense>}
      {tab === 'inventory' && (
        <PageBody>
          <PageHeader title="Magazzino" subtitle="Quanto costa ciò che vendi, cosa si perde e quanto spendi con i fornitori." />
          <Suspense fallback={<Loading />}><ReportPanel dish={dish} /></Suspense>
        </PageBody>)}
    </div>
  );
};

export default StatsTabs;
