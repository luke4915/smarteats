import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import ProductConfig from '../../components/products/ProductConfig';
import { PageHeader, PageBody } from '../../components/shared/PageHeader';
import { useModifiers } from '../floor/useModifiers';
import ModifierSettings from './ModifierSettings';

// La carta (prodotti, prezzi, portate e opzioni): l'editor dei prodotti è lo stesso della cassa, con in più le portate e
// i gruppi di opzioni del ristorante.
const CatalogPage = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const hasTables = !!user.modules?.includes('tables');
  const [products, setProducts] = useState(null);
  const [courses, setCourses] = useState(null);
  const modifiers = useModifiers();
  useEffect(() => {
    // Le portate e le opzioni esistono solo con il modulo dei tavoli: un locale di solo asporto ha la carta semplice
    Promise.all([fetchWithAuth('/products'), hasTables ? fetchWithAuth('/courses') : []])
      .then(([list, courseList]) => { setProducts(list.map(p => ({ ...p, price: parseFloat(p.price) }))); setCourses(hasTables ? courseList.filter(c => c.active) : null); })
      .catch(err => showToast(err.message || 'Errore caricamento carta', 'error'));
  }, [showToast, hasTables]);
  if (!products || (hasTables && !courses)) return <p className="text-[var(--text-muted)]">Caricamento carta…</p>;
  return (
    <PageBody>
      <PageHeader title="Carta" subtitle={hasTables ? 'Piatti, prezzi, portate e opzioni.' : 'Prodotti e prezzi.'} />
      <ProductConfig hideHeader takeawayEnabled={!!user.modules?.includes('takeaway')} products={products} setProducts={setProducts} courses={courses} modifierGroups={hasTables ? modifiers.groups : null} onModifiersSaved={modifiers.reload} />
      {hasTables && <ModifierSettings groups={modifiers.groups} onChanged={modifiers.reload} />}
    </PageBody>
  );
};

export default CatalogPage;
