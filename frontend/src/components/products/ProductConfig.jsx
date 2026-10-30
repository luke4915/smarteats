import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import RecipeModal from '../../inventory/RecipeModal';
import { useRecipeData, recipesEnabled } from '../../inventory/useRecipeData';
import CompactCatalog from './CompactCatalog';
import ProductFormModal from './ProductFormModal';
import ProductAvailabilitySheet from './ProductAvailabilitySheet';
import { DuplicateDialog, DeleteDialog } from './ProductDialogs';
import { useProductActions } from './useProductActions';
import { productConflict } from './productConflict';
import { blankForm, formFromProduct, cleanPriceInput, colorOfCategory, findNameConflict, stockProblem } from './productForm';

// L'editor dei prodotti (carta del ristorante e listino della sagra), uguale nei due prodotti: l'intestazione della pagina la mette chi lo
// usa (`PageHeader`), qui non ce n'è. Qui sta solo il coordinamento:
//   - `productForm.js`        le regole del modulo (valori iniziali, doppioni, quantità valide), pure e provate
//   - `useProductActions.js`  le chiamate al server (salva, mostra/nascondi, elimina)
//   - `ProductFormModal.jsx`  la finestra del modulo;  `ProductDialogs.jsx` le conferme
//   - `CompactCatalog.jsx`   l'elenco, uguale nella sagra e nel ristorante
// `noun`: come si chiamano i prodotti nel locale. `courses` (portate) e `modifierGroups` (opzioni) esistono solo nei ristoranti;
// `takeawayEnabled` aggiunge il carico sul forno. `onModifiersSaved` rilegge le opzioni dopo un salvataggio.
const ProductConfig = ({ products, setProducts, courses = null, modifierGroups = null, onModifiersSaved, takeawayEnabled = false, noun = 'prodotto' }) => {
  const { user } = useAuth();
  const portionsEnabled = !!user?.inventory;            // col modulo magazzino le porzioni hanno una regola di azzeramento
  const vatEnabled = user?.inventory?.mode === 'warehouse';   // l'IVA serve ai margini del magazzino
  const options = { courses, takeawayEnabled, modifierGroups, portions: portionsEnabled, vat: vatEnabled };
  const actions = useProductActions({ setProducts, hasModifierGroups: !!modifierGroups, onModifiersSaved });
  const [editing, setEditing] = useState(null);          // il prodotto in modifica (null = nuovo)
  const [form, setForm] = useState(null);                // il modulo aperto (null = chiuso)
  const [conflict, setConflict] = useState(null);        // un prodotto con lo stesso nome esiste già
  const [toDelete, setToDelete] = useState(null);
  const [availabilityOf, setAvailabilityOf] = useState(null);   // il prodotto di cui si cambia la disponibilità (la scheda della cassa)
  const kitchen = useRecipeData(recipesEnabled(user));   // ricette dei piatti (solo con il magazzino «dalle ricette»)
  const [recipeOf, setRecipeOf] = useState(null);         // il prodotto di cui si scrive la ricetta

  const openNew = () => { setEditing(null); setForm(blankForm(options)); };
  const openEdit = (product) => { setEditing(product); setForm(formFromProduct(product, options)); };
  const close = () => setForm(null);

  // Un altro amministratore ha cambiato o eliminato il prodotto mentre lo si modifica: il modulo lo dice e propone i valori aggiornati.
  const live = editing ? products.find(p => p.id === editing.id) : null;
  const editConflict = form && editing ? productConflict(editing, live) : null;
  const useLatest = () => { setEditing(live); setForm(formFromProduct(live, options)); };

  // Cambio di un campo qualsiasi del modulo (testo, casella, colore). Il prezzo accetta solo cifre.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'price') {
      const price = cleanPriceInput(value);
      if (price !== null) setForm(prev => ({ ...prev, price }));
    } else setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  // Cambio di un campo scelto da un elenco: scegliendo una categoria esistente il colore diventa il suo.
  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value, ...(name === 'category' && colorOfCategory(products, value) && { color: colorOfCategory(products, value) }) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const found = findNameConflict(products, form, editing?.id ?? null);
    if (found) return setConflict(found);
    if (await actions.save(form, editing)) close();
  };

  return (
    <div className="space-y-5 relative">
      <CompactCatalog products={products} courses={courses} noun={noun} recipes={kitchen.data && { summaryOf: kitchen.data.summaryOf, onOpen: setRecipeOf }} onAdd={openNew} onEdit={openEdit} onDelete={setToDelete}
        onToggleVisible={actions.toggleVisibility} onAvailability={setAvailabilityOf} onSetManyVisible={actions.setManyVisible} />

      {form && (
        <ProductFormModal noun={noun} form={form} setForm={setForm} products={products} editing={editing} courses={courses} modifierGroups={modifierGroups} takeawayEnabled={takeawayEnabled} portionsEnabled={portionsEnabled} vatEnabled={vatEnabled}
          submitDisabled={!!stockProblem(form) || !!editConflict?.removed} conflict={editConflict} onUseLatest={useLatest} onField={setField} onChange={handleChange} onSubmit={submit} onClose={close} />
      )}
      {availabilityOf && (
        <ProductAvailabilitySheet key={availabilityOf.id} product={availabilityOf} onClose={() => setAvailabilityOf(null)}
          onSaved={(updated) => setProducts(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)))} />
      )}
      {recipeOf && <RecipeModal product={recipeOf} dish={noun} showCosts ingredients={kitchen.data.ingredients} preparations={kitchen.data.preparations} onClose={() => setRecipeOf(null)} onSaved={kitchen.reload} />}
      {conflict && <DuplicateDialog noun={noun} conflict={conflict} onClose={() => setConflict(null)} onUseCategory={() => { setField('category', conflict.product.category); setConflict(null); }} />}
      {toDelete && <DeleteDialog product={toDelete} onClose={() => setToDelete(null)} onConfirm={async () => { if (await actions.remove(toDelete)) setToDelete(null); }} />}
    </div>
  );
};

export default ProductConfig;
