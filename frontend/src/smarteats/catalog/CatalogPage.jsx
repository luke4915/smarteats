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
  const [products, setProducts] = useState(null);
  const [courses, setCourses] = useState(null);
  const modifiers = useModifiers();
  useEffect(() => {
    Promise.all([fetchWithAuth('/products'), fetchWithAuth('/courses')])
      .then(([list, courseList]) => { setProducts(list.map(p => ({ ...p, price: parseFloat(p.price) }))); setCourses(courseList.filter(c => c.active)); })
      .catch(err => showToast(err.message || 'Errore caricamento carta', 'error'));
  }, [showToast]);
  if (!products || !courses) return <p className="text-[var(--text-muted)]">Caricamento carta…</p>;
  return (
    <PageBody>
      <PageHeader title="Carta" subtitle="Piatti, prezzi, portate e opzioni." />
      <ProductConfig hideHeader takeawayEnabled={!!user.modules?.includes('takeaway')} products={products} setProducts={setProducts} courses={courses} modifierGroups={modifiers.groups} onModifiersSaved={modifiers.reload} />
      <ModifierSettings groups={modifiers.groups} onChanged={modifiers.reload} />
    </PageBody>
  );
};

export default CatalogPage;
