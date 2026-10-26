import Modal from '../shared/Modal';
import Combobox from './Combobox';
import PortionsField from './PortionsField';
import { categoryColors, namesForCategory } from './productForm';

const box = 'p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]';
const smallLabel = 'text-xs font-semibold text-[var(--text-muted)] block';
const selectClass = 'w-full h-10 px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-main)] text-sm focus:outline-none focus:border-[var(--accent)]';
const PRINT_OPTIONS = [
  { value: 'both', label: 'Tutti', desc: 'Bar + Cucina' },
  { value: 'bar', label: 'Solo Bar', desc: 'Ritiro Bar' },
  { value: 'kitchen', label: 'Solo Cucina', desc: 'Gastronomia' },
];
const VAT_RATES = ['4', '5', '10', '22', '0'];
const OVEN_LOAD = [[0, 'Niente (bibite, dolci già pronti…)'], [1, 'Una porzione (una pizza)'], [2, 'Due porzioni (pizza grande, teglia)'], [3, 'Tre porzioni']];

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
        <button type="submit" disabled={submitDisabled}
          className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {editing ? 'Salva modifiche' : 'Aggiungi prodotto'}
        </button>}>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className={`col-span-2 ${box} space-y-1.5`}>
        <label className={smallLabel}>Categoria</label>
        <Combobox name="category" value={form.category} onChange={(v) => onField('category', v)} options={categories} placeholder="Seleziona o inserisci categoria (es. Pizze, Bevande)" />
      </div>
      <div className={`col-span-2 ${box} space-y-1.5`}>
        <label className={smallLabel}>Nome Prodotto</label>
        <Combobox name="name" value={form.name} onChange={(v) => onField('name', v)} options={namesForCategory(products, form.category)} placeholder="Inserisci nome prodotto (es. Margherita, Coca Cola)" />
      </div>
      <div className={`col-span-2 ${box} space-y-1.5`}>
        <label className={smallLabel}>Prezzo (€)</label>
        <input name="price" type="text" inputMode="decimal" placeholder="0.00" value={form.price} onChange={onChange} required
          className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-main)] font-medium text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className={`${box} flex flex-col justify-between space-y-2`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Colore Categoria</label>
          <input type="color" name="color" value={form.color} onChange={onChange} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
        </div>
        {products.length > 0 && (
          <div className="pt-2 border-t border-[var(--border)]/40 flex flex-wrap gap-1.5">
            {categoryColors(products).map(c => (
              <button key={c.id} type="button" title={c.category} aria-label={`Usa il colore di ${c.category}`}
                onClick={() => setForm(prev => ({ ...prev, color: c.color, category: prev.category || c.category }))}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                style={{ backgroundColor: c.color, borderColor: form.color.toLowerCase() === c.color.toLowerCase() ? 'var(--text-main)' : 'transparent' }} />
            ))}
          </div>
        )}
      </div>

      <div className={box}>
        <span className={`${smallLabel} mb-2`}>Stampa</span>
        <div className="flex gap-1.5">
          {PRINT_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => patch({ print_destination: opt.value })}
              className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${form.print_destination === opt.value ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'}`}>
              <div>{opt.label}</div>
              <div className="text-[11px] font-medium opacity-70 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {modifierGroups && modifierGroups.length > 0 && (
        <div className={box}>
          <span className="text-xs font-medium text-[var(--text-muted)] block mb-2">Opzioni da chiedere (cottura, aggiunte…)</span>
          <div className="flex flex-wrap gap-1.5">
            {modifierGroups.map(g => {
              const on = (form.modifier_group_ids ?? []).includes(g.id);
              return (
                <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleModifierGroup(g.id)}
                  className={`h-8 px-3 rounded-full text-xs font-medium border transition cursor-pointer ${on ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{g.name}</button>
              );
            })}
          </div>
        </div>
      )}

      {courses && (
        <div className={box}>
          <label htmlFor="course" className="text-xs font-medium text-[var(--text-muted)] block mb-2">Portata</label>
          <select id="course" value={form.course_id ?? ''} onChange={e => patch({ course_id: e.target.value ? Number(e.target.value) : null })} className={selectClass}>
            <option value="">Nessuna (esce subito: bevande, pane…)</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {takeawayEnabled && (
        <div className={box}>
          <label htmlFor="takeaway_load" className="text-xs font-medium text-[var(--text-muted)] block mb-2">Asporto: quanto impegna il forno</label>
          <select id="takeaway_load" value={form.takeaway_load ?? 1} onChange={e => patch({ takeaway_load: Number(e.target.value) })} className={selectClass}>
            {OVEN_LOAD.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </div>
      )}

      {vatEnabled && (
        <div className={box}>
          <label htmlFor="vat_rate" className="text-xs font-medium text-[var(--text-muted)] block mb-2">IVA (per i margini)</label>
          <select id="vat_rate" value={form.vat_rate ?? ''} onChange={e => patch({ vat_rate: e.target.value })} className={selectClass}>
            <option value="">Quella predefinita del locale</option>
            {VAT_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
          </select>
        </div>
      )}

      {editing && (
        <div className={`${box} flex items-center gap-3`}>
          <input type="checkbox" id="visible" name="visible" checked={form.visible} onChange={onChange} className="w-4 h-4 rounded cursor-pointer" />
          <label htmlFor="visible" className="text-xs font-bold text-[var(--text-main)] cursor-pointer">Visibile nel listino</label>
        </div>
      )}

      {portionsEnabled ? (
        <div className={`col-span-2 ${box}`}><PortionsField form={form} onChange={patch} /></div>
      ) : (
      <div className={`${box} space-y-2`}>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="stock_enabled" name="stock_enabled" checked={form.stock_enabled || false} onChange={onChange} className="w-4 h-4 rounded cursor-pointer" />
          <label htmlFor="stock_enabled" className="text-xs font-bold text-[var(--text-main)] cursor-pointer">Disponibilità limitata</label>
        </div>
        {form.stock_enabled && (
          <input type="number" name="stock" min="0" value={form.stock} onChange={onChange} placeholder="Quantità disponibile"
            className="w-full p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-main)] text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        )}
      </div>
      )}
    </div>
    </Modal>
  );
};

export default ProductFormModal;
