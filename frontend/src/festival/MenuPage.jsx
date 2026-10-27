import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import ProductConfig from '../components/products/ProductConfig';
import PreparationsSection from '../inventory/PreparationsSection';
import { PageBody, PageHeader } from '../components/shared/PageHeader';
import Segmented from '../smarteats/floor/Segmented';
import { recipesEnabled } from '../inventory/useRecipeData';

// Il menu della sagra: i prodotti e, nei locali con le ricette, le «Preparazioni» (il sugo base) accanto. Ogni prodotto ha il suo
// pulsante «Ricetta» (lo mette l'elenco dei prodotti).
const MenuPage = ({ products, setProducts }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');
  if (!recipesEnabled(user)) return <ProductConfig products={products} setProducts={setProducts} />;
  return (
    <PageBody>
      <PageHeader title="Menu" subtitle="Prodotti, ricette e preparazioni." />
      <Segmented label="Sezioni del menu" className="w-fit" value={tab} onChange={setTab} options={[{ id: 'products', label: 'Prodotti' }, { id: 'preparations', label: 'Preparazioni' }]} />
      {tab === 'products' ? <ProductConfig hideHeader products={products} setProducts={setProducts} /> : <PreparationsSection />}
    </PageBody>
  );
};

export default MenuPage;
