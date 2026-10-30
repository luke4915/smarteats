import { useState, useEffect } from 'react';
import Segmented from '../floor/Segmented';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import ProductConfig from '../../components/products/ProductConfig';
import { PageHeader, PageBody } from '../../components/shared/PageHeader';
import { useModifiers } from '../floor/useModifiers';
import ModifierSettings from './ModifierSettings';
import PreparationsSection from '../../inventory/PreparationsSection';
import OptionRecipesSection from '../../inventory/OptionRecipesSection';
import { recipesEnabled } from '../../inventory/useRecipeData';
import Loading from '../../components/shared/Loading';
import { applyProductEvent } from '../../utils/productEvents';

// La carta (prodotti, prezzi, portate e opzioni; segue gli avvisi in tempo reale degli altri amministratori): l'editor dei prodotti è lo stesso della cassa, con in più le portate e
// i gruppi di opzioni del ristorante. Nei locali con le ricette, ogni piatto ha il suo pulsante «Ricetta», le opzioni dicono cosa
// cambiano in magazzino e le «Preparazioni» (il sugo base) stanno qui accanto.
const CatalogPage = ({ event = null }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const hasTables = !!user.modules?.includes('tables');
  const [products, setProducts] = useState(null);
  const [courses, setCourses] = useState(null);
  const modifiers = useModifiers();
  const [tab, setTab] = useState('dishes');
  const withRecipes = recipesEnabled(user);
  const sections = [{ id: 'dishes', label: 'Piatti' }, ...(hasTables ? [{ id: 'options', label: 'Opzioni' }] : []), ...(withRecipes ? [{ id: 'preparations', label: 'Preparazioni' }] : [])];
  useEffect(() => {
    // Le portate e le opzioni esistono solo con il modulo dei tavoli: un locale di solo asporto ha la carta semplice
    Promise.all([fetchWithAuth('/products'), hasTables ? fetchWithAuth('/courses') : []])
      .then(([list, courseList]) => { setProducts(list.map(p => ({ ...p, price: parseFloat(p.price) }))); setCourses(hasTables ? courseList.filter(c => c.active) : null); })
      .catch(err => showToast(err.message || 'Errore caricamento carta', 'error'));
  }, [showToast, hasTables]);
  // Un altro amministratore cambia la carta: l'elenco lo segue senza ricaricare (e il modulo aperto avvisa se tocca lo stesso piatto)
  useEffect(() => { if (event) setProducts(prev => (prev ? applyProductEvent(prev, event) : prev)); }, [event]);
  if (!products || (hasTables && !courses)) return <Loading />;
  return (
    <PageBody>
      <PageHeader title="Carta" subtitle={hasTables ? 'Piatti, prezzi, portate e opzioni.' : 'Prodotti e prezzi.'} />
      {sections.length > 1 && <Segmented scroll label="Sezioni della carta" value={tab} onChange={setTab} className="w-fit max-w-full" options={sections} />}
      {tab === 'dishes' && <ProductConfig noun="piatto" takeawayEnabled={!!user.modules?.includes('takeaway')} products={products} setProducts={setProducts} courses={courses} modifierGroups={hasTables ? modifiers.groups : null} onModifiersSaved={modifiers.reload} />}
      {hasTables && tab === 'options' && <><ModifierSettings groups={modifiers.groups} onChanged={modifiers.reload} />{withRecipes && <OptionRecipesSection />}</>}
      {withRecipes && tab === 'preparations' && <PreparationsSection />}
    </PageBody>
  );
};

export default CatalogPage;
