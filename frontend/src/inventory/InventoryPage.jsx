import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { PageHeader, PageBody } from '../components/shared/PageHeader';
import Segmented from '../smarteats/floor/Segmented';
import { useInventoryData } from './useInventoryData';
import IngredientsPanel from './IngredientsPanel';
import SuppliersPanel from './SuppliersPanel';
import ReceiptsPanel from './ReceiptsPanel';
import StockLevelsPanel from './StockLevelsPanel';
import Loading from '../components/shared/Loading';

// Il magazzino (modalità «magazzino» scelta dal master): la dispensa, gli scarichi di merce (quando arriva la merce), i fornitori
// e i controlli (conteggi). Le ricette e le preparazioni stanno nella Carta. Scarti e correzioni si fanno dalla scheda dell'ingrediente; costi, margini e acquisti stanno in Statistiche. Lo usano
// SmartEats Restaurant e SmartEats Stand. Ogni scheda ha il suo file: qui si compone la pagina e si tengono i dati.
const InventoryPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('ingredients');
  const { data, reload } = useInventoryData();
  const tabs = [
    { id: 'ingredients', label: 'Ingredienti' },
    { id: 'receipts', label: 'Scarichi' },
    { id: 'suppliers', label: 'Fornitori' },
    { id: 'levels', label: 'Controlli' },
  ];

  return (
    <PageBody>
      <PageHeader title="Magazzino" subtitle="Dispensa, scarichi di merce e controlli: la dispensa si scala a ogni vendita." />
      <Segmented scroll label="Sezioni del magazzino" className="w-fit max-w-full" value={tab} onChange={setTab} options={tabs} />
      {!data ? <Loading /> : (
        <>
          {tab === 'ingredients' && <IngredientsPanel ingredients={data.ingredients} restock={data.restock} showCosts onChanged={reload} />}
          {tab === 'receipts' && <ReceiptsPanel suppliers={data.suppliers} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'suppliers' && <SuppliersPanel suppliers={data.suppliers} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'levels' && <StockLevelsPanel ingredients={data.ingredients} simpleDepletion={user.inventory?.depletion === 'simple'} onChanged={reload} />}
        </>)}
    </PageBody>
  );
};

export default InventoryPage;
