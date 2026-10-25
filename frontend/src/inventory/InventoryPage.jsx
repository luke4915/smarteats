import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { PageHeader, PageBody } from '../components/shared/PageHeader';
import Segmented from '../smarteats/floor/Segmented';
import { useInventoryData } from './useInventoryData';
import IngredientsPanel from './IngredientsPanel';
import PreparationsPanel from './PreparationsPanel';
import RecipesPanel from './RecipesPanel';
import OptionRecipesPanel from './OptionRecipesPanel';

// Il magazzino (modalità «magazzino» scelta dal master): la dispensa, le preparazioni e le ricette dei piatti. Lo usano
// SmartEats Restaurant e SmartEats Stand. Ogni scheda ha il suo file: qui si compone la pagina e si tengono i dati.
const InventoryPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('ingredients');
  const { data, reload } = useInventoryData();
  const dish = user.businessType === 'street_food' ? 'prodotto' : 'piatto';
  const hasOptions = !!user.modules?.includes('tables');
  const tabs = [
    { id: 'ingredients', label: 'Ingredienti' },
    { id: 'preparations', label: 'Preparazioni' },
    { id: 'recipes', label: 'Ricette' },
    ...(hasOptions ? [{ id: 'options', label: 'Opzioni' }] : []),
  ];

  return (
    <PageBody>
      <PageHeader title="Magazzino" subtitle="Ingredienti, preparazioni e ricette: la dispensa si scala a ogni vendita." />
      <Segmented scroll label="Sezioni del magazzino" className="w-fit max-w-full" value={tab} onChange={setTab} options={tabs} />
      {!data ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <>
          {tab === 'ingredients' && <IngredientsPanel ingredients={data.ingredients} showCosts onChanged={reload} />}
          {tab === 'preparations' && <PreparationsPanel preparations={data.preparations} ingredients={data.ingredients} onChanged={reload} />}
          {tab === 'recipes' && <RecipesPanel products={data.products} recipes={data.recipes} ingredients={data.ingredients} preparations={data.preparations} dish={dish} showCosts onChanged={reload} />}
          {tab === 'options' && <OptionRecipesPanel ingredients={data.ingredients} />}
        </>)}
    </PageBody>
  );
};

export default InventoryPage;
