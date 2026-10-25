import { useState } from 'react';
import { PageHeader } from '../shared/PageHeader';
import { useAuth } from '../../context/useAuth';
import CompactCatalog from './CompactCatalog';
import ProductGroups from './ProductGroups';
import ProductFormModal from './ProductFormModal';
import { DuplicateDialog, DeleteDialog } from './ProductDialogs';
import { useProductActions } from './useProductActions';
import { blankForm, formFromProduct, cleanPriceInput, colorOfCategory, findNameConflict, stockProblem } from './productForm';

// L'editor dei prodotti (carta del ristorante e listino della sagra). Qui sta solo il coordinamento:
//   - `productForm.js`        le regole del modulo (valori iniziali, doppioni, quantità valide), pure e provate
//   - `useProductActions.js`  le chiamate al server (salva, mostra/nascondi, elimina)
//   - `ProductFormModal.jsx`  la finestra del modulo;  `ProductDialogs.jsx` le conferme
//   - `CompactCatalog.jsx` (ristorante) e `ProductGroups.jsx` (sagra) l'elenco
// `compact`: elenco del ristorante. `courses` (portate) e `modifierGroups` (opzioni) esistono solo nei ristoranti;
// `takeawayEnabled` aggiunge il carico sul forno. `onModifiersSaved` rilegge le opzioni dopo un salvataggio.
const ProductConfig = ({ products, setProducts, courses = null, modifierGroups = null, onModifiersSaved, hideHeader = false, takeawayEnabled = false, compact = false }) => {
  const { user } = useAuth();
  const portionsEnabled = !!user?.inventory;            // col modulo magazzino le porzioni hanno una regola di azzeramento
  const vatEnabled = user?.inventory?.mode === 'warehouse';   // l'IVA serve ai margini del magazzino
  const options = { courses, takeawayEnabled, modifierGroups, portions: portionsEnabled, vat: vatEnabled };
  const actions = useProductActions({ setProducts, hasModifierGroups: !!modifierGroups, onModifiersSaved });
  const [editing, setEditing] = useState(null);          // il prodotto in modifica (null = nuovo)
  const [form, setForm] = useState(null);                // il modulo aperto (null = chiuso)
  const [conflict, setConflict] = useState(null);        // un prodotto con lo stesso nome esiste già
  const [toDelete, setToDelete] = useState(null);

  const openNew = () => { setEditing(null); setForm(blankForm(options)); };
  const openEdit = (product) => { setEditing(product); setForm(formFromProduct(product, options)); };
  const close = () => setForm(null);

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
    <div className="max-w-5xl mx-auto w-full space-y-5 relative">
      {!hideHeader && <PageHeader title="Menu" subtitle="Gestione prodotti" />}

      {compact
        ? <CompactCatalog products={products} courses={courses} onAdd={openNew} onEdit={openEdit} onDelete={setToDelete} onToggleVisible={actions.toggleVisibility} />
        : <ProductGroups products={products} onAdd={openNew} onEdit={openEdit} onDelete={setToDelete} onToggleVisible={actions.toggleVisibility} onSetManyVisible={actions.setManyVisible} />}

      {form && (
        <ProductFormModal form={form} setForm={setForm} products={products} editing={editing} courses={courses} modifierGroups={modifierGroups} takeawayEnabled={takeawayEnabled} portionsEnabled={portionsEnabled} vatEnabled={vatEnabled}
          submitDisabled={!!stockProblem(form)} onField={setField} onChange={handleChange} onSubmit={submit} onClose={close} />
      )}
      {conflict && <DuplicateDialog conflict={conflict} onClose={() => setConflict(null)} onUseCategory={() => { setField('category', conflict.product.category); setConflict(null); }} />}
      {toDelete && <DeleteDialog product={toDelete} onClose={() => setToDelete(null)} onConfirm={async () => { if (await actions.remove(toDelete)) setToDelete(null); }} />}
    </div>
  );
};

export default ProductConfig;
