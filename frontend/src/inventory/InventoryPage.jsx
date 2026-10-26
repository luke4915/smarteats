import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { PageHeader, PageBody } from '../components/shared/PageHeader';
import Segmented from '../smarteats/floor/Segmented';
import { useInventoryData } from './useInventoryData';
import IngredientsPanel from './IngredientsPanel';
import PreparationsPanel from './PreparationsPanel';
import RecipesPanel from './RecipesPanel';
import OptionRecipesPanel from './OptionRecipesPanel';
import SuppliersPanel from './SuppliersPanel';
import ReceiptsPanel from './ReceiptsPanel';
import StockLevelsPanel from './StockLevelsPanel';
import Loading from '../components/shared/Loading';

// Il magazzino (modalità «magazzino» scelta dal master): la dispensa, i carichi di merce, i fornitori, le preparazioni e le ricette,
// e i controlli (conteggi). Scarti e correzioni si fanno dalla scheda dell'ingrediente; costi, margini e acquisti stanno in Statistiche. Lo usano
// SmartEats Restaurant e SmartEats Stand. Ogni scheda ha il suo file: qui si compone la pagina e si tengono i dati.
const InventoryPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('ingredients');
  const { data, reload } = useInventoryData();
  const dish = user.businessType === 'street_food' ? 'prodotto' : 'piatto';
  const hasOptions = !!user.modules?.includes('tables');
  const tabs = [
    { id: 'ingredients', label: 'Ingredienti' },
    { id: 'receipts', label: 'Carichi' },
    { id: 'suppliers', label: 'Fornitori' },
    { id: 'recipes', label: 'Ricette' },
    { id: 'preparations', label: 'Preparazioni' },
    ...(hasOptions ? [{ id: 'options', label: 'Opzioni' }] : []),
    { id: 'levels', label: 'Controlli' },
  ];

  return (
    <PageBody>
      <PageHeader title="Magazzino" subtitle="Dispensa, carichi, ricette e controlli: la dispensa si scala a ogni vendita." />
      <Segmented scroll label="Sezioni del magazzino" className="w-fit max-w-full" value={tab} onChange={setTab} options={tabs} />
      {!data ? <Loading /> : (
        <>
          {tab === 'ingredients' && <IngredientsPanel ingredients={data.ingredients} restock={data.restock} showCosts onChanged={reload} />}
          {tab === 'receipts' && <ReceiptsPanel suppliers={data.suppliers} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'suppliers' && <SuppliersPanel suppliers={data.suppliers} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'preparations' && <PreparationsPanel preparations={data.preparations} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'recipes' && <RecipesPanel products={data.products} recipes={data.recipes} ingredients={data.ingredients} preparations={data.preparations} dish={dish} showCosts onChanged={reload} />}
          {tab === 'options' && <OptionRecipesPanel ingredients={data.ingredients} />}
          {tab === 'levels' && <StockLevelsPanel ingredients={data.ingredients} simpleDepletion={user.inventory?.depletion === 'simple'} onChanged={reload} />}
        </>)}
    </PageBody>
  );
};

export default InventoryPage;
