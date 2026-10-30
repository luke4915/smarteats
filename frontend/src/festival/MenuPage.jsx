import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import ProductConfig from '../components/products/ProductConfig';
import PreparationsSection from '../inventory/PreparationsSection';
import { PageBody, PageHeader } from '../components/shared/PageHeader';
import Segmented from '../smarteats/floor/Segmented';
import { recipesEnabled } from '../inventory/useRecipeData';

// Il menu della sagra: stessa pagina della carta del ristorante (testata, sezioni, elenco dei prodotti). Nei locali con le ricette
// compare anche «Preparazioni» (il sugo base); ogni prodotto ha il suo pulsante «Ricetta» (lo mette l'elenco dei prodotti).
const MenuPage = ({ products, setProducts }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');
  const withRecipes = recipesEnabled(user);
  return (
    <PageBody>
      <PageHeader title="Menu" subtitle={withRecipes ? 'Prodotti, ricette e preparazioni.' : 'Prodotti e prezzi.'} />
      {withRecipes && <Segmented label="Sezioni del menu" className="w-fit" value={tab} onChange={setTab} options={[{ id: 'products', label: 'Prodotti' }, { id: 'preparations', label: 'Preparazioni' }]} />}
      {!withRecipes || tab === 'products' ? <ProductConfig products={products} setProducts={setProducts} /> : <PreparationsSection />}
    </PageBody>
  );
};

export default MenuPage;
