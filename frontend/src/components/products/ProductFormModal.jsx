import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import Switch from '../shared/Switch';
import Segmented from '../../smarteats/floor/Segmented';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';
import Combobox from './Combobox';
import PortionsField from './PortionsField';
import { categoryColors, namesForCategory } from './productForm';

const PRINT_OPTIONS = [{ id: 'both', label: 'Bar e cucina' }, { id: 'bar', label: 'Solo bar' }, { id: 'kitchen', label: 'Solo cucina' }];
const VAT_RATES = ['4', '5', '10', '22', '0'];
const OVEN_LOAD = [[0, 'Niente (bibite, dolci già pronti…)'], [1, 'Una porzione (una pizza)'], [2, 'Due porzioni (pizza grande, teglia)'], [3, 'Tre porzioni']];

// Un campo con la sua etichetta; `hint` è la spiegazione in piccolo.
const Field = ({ title, htmlFor, hint, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={`${label} block mb-1`}>{title}</label>
    {children}
    {hint && <p className="text-xs text-[var(--text-muted)] mt-1">{hint}</p>}
  </div>
);

// Una riga con un interruttore, come nelle impostazioni.
const SwitchRow = ({ title, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-1"><span className="text-sm text-[var(--text-main)]">{title}</span><Switch label={title} checked={checked} onChange={onChange} /></div>
);

// La finestra per aggiungere o modificare un prodotto. Non salva nulla da sola: mostra `form` e avvisa chi la usa
// (`onField`, `onChange`, `onSubmit`). Sta sempre nello schermo: il corpo scorre, il pulsante resta fisso in basso.
// `courses`, `modifierGroups`, `takeawayEnabled`, `portionsEnabled` (modulo magazzino) e `vatEnabled` (modalità «magazzino») accendono i campi che esistono solo in certi locali.
const ProductFormModal = ({ form, setForm, products, editing, courses, modifierGroups, takeawayEnabled, portionsEnabled, vatEnabled, submitDisabled, onField, onChange, onSubmit, onClose }) => {
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const patch = (changes) => setForm(prev => ({ ...prev, ...changes }));
  const toggleModifierGroup = (id) => setForm(prev => {
    const current = prev.modifier_group_ids ?? [];
    return { ...prev, modifier_group_ids: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
  });

  return (
    <Modal title={editing ? 'Modifica prodotto' : 'Nuovo prodotto'} size="max-w-2xl" dismissOnBackdrop={false} onClose={onClose} onSubmit={onSubmit}
      footer={
        <ModalActions onCancel={onClose}>
          <button type="submit" disabled={submitDisabled} className={btnPrimary}>{editing ? 'Salva modifiche' : 'Aggiungi prodotto'}</button>
        </ModalActions>}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
          <Field title="Categoria"><Combobox name="category" value={form.category} onChange={(v) => onField('category', v)} options={categories} placeholder="Es. Pizze, Bevande" /></Field>
          <Field title="Prezzo (€)" htmlFor="price">
            <input id="price" name="price" type="text" inputMode="decimal" placeholder="0,00" value={form.price} onChange={onChange} required className={`${input} tabular-nums`} />
          </Field>
          <Field title="Nome" className="sm:col-span-2"><Combobox name="name" value={form.name} onChange={(v) => onField('name', v)} options={namesForCategory(products, form.category)} placeholder="Es. Margherita, Coca-Cola" /></Field>
        </div>

        <Field title="Colore in cassa" hint="Il colore della categoria aiuta a trovare il prodotto a colpo d'occhio.">
          <div className="flex flex-wrap items-center gap-2">
            <input type="color" name="color" value={form.color} onChange={onChange} aria-label="Colore" className="w-9 h-9 rounded-full cursor-pointer border-0 bg-transparent p-0" />
            {products.length > 0 && categoryColors(products).map(c => (
              <button key={c.id} type="button" title={c.category} aria-label={`Usa il colore di ${c.category}`}
                onClick={() => setForm(prev => ({ ...prev, color: c.color, category: prev.category || c.category }))}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                style={{ backgroundColor: c.color, borderColor: form.color.toLowerCase() === c.color.toLowerCase() ? 'var(--text-main)' : 'transparent' }} />
            ))}
          </div>
        </Field>

        <Field title="Dove si prepara"><Segmented label="Stampa" scroll value={form.print_destination} onChange={(value) => patch({ print_destination: value })} options={PRINT_OPTIONS} /></Field>

        {modifierGroups && modifierGroups.length > 0 && (
          <Field title="Opzioni da chiedere (cottura, aggiunte…)">
            <div className="flex flex-wrap gap-1.5">
              {modifierGroups.map(g => {
                const on = (form.modifier_group_ids ?? []).includes(g.id);
                return (
                  <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleModifierGroup(g.id)}
                    className={`h-9 coarse:h-11 px-3.5 rounded-full text-sm font-medium border transition cursor-pointer ${on ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{g.name}</button>
                );
              })}
            </div>
          </Field>
        )}

        {(courses || takeawayEnabled || vatEnabled) && (
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
            {courses && (
              <Field title="Portata" htmlFor="course" className="sm:col-span-2">
                <select id="course" value={form.course_id ?? ''} onChange={e => patch({ course_id: e.target.value ? Number(e.target.value) : null })} className={input}>
                  <option value="">Nessuna (esce subito: bevande, pane…)</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {takeawayEnabled && (
              <Field title="Asporto: quanto impegna il forno" htmlFor="takeaway_load">
                <select id="takeaway_load" value={form.takeaway_load ?? 1} onChange={e => patch({ takeaway_load: Number(e.target.value) })} className={input}>
                  {OVEN_LOAD.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </Field>
            )}
            {vatEnabled && (
              <Field title="IVA (per i margini)" htmlFor="vat_rate">
                <select id="vat_rate" value={form.vat_rate ?? ''} onChange={e => patch({ vat_rate: e.target.value })} className={input}>
                  <option value="">Quella predefinita del locale</option>
                  {VAT_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                </select>
              </Field>
            )}
          </div>
        )}

        {portionsEnabled ? <PortionsField form={form} onChange={patch} /> : (
          <div className="space-y-3">
            <SwitchRow title="Disponibilità limitata" checked={!!form.stock_enabled} onChange={(on) => patch({ stock_enabled: on })} />
            {form.stock_enabled && (
              <input type="number" name="stock" min="0" value={form.stock} onChange={onChange} placeholder="Quantità disponibile" aria-label="Quantità disponibile" className={input} />
            )}
          </div>
        )}

        {editing && <SwitchRow title="Visibile nel listino" checked={!!form.visible} onChange={(on) => patch({ visible: on })} />}
      </div>
    </Modal>
  );
};

export default ProductFormModal;
