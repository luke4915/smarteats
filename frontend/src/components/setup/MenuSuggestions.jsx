import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { fetchWithAuth } from '../../utils/apiClient';
import { categoriesInOrder } from '../../utils/categoryOrder';
import { btn, btnPrimary, select } from '../shared/styles';

// I suggerimenti del menu pubblico: «quando il cliente sceglie [categoria o prodotto], proponi [prodotto]». Compaiono come una riga discreta
// sopra il pulsante dell'ordine, uno alla volta, e il cliente li scarta con una X. Funzione facoltativa e a sé: senza regole il menu non cambia.
// Il valore di «quando» è `c:Categoria` oppure `p:id`.
const toRule = (when, suggest) => (when.startsWith('c:') ? { category: when.slice(2), suggest } : { product: Number(when.slice(2)), suggest });
const whenOf = (r) => (r.category ? `c:${r.category}` : `p:${r.product}`);

const MenuSuggestions = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState(null);
  const [rules, setRules] = useState(null);
  const [saved, setSaved] = useState('[]');
  const [draft, setDraft] = useState({ when: '', suggest: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetchWithAuth('/products'), fetchWithAuth('/menu-suggestions')])
      .then(([list, data]) => { setProducts(list); setRules(data.rules); setSaved(JSON.stringify(data.rules)); })
      .catch(() => { setProducts([]); setRules([]); });
  }, []);
  if (!products || !rules) return null;

  const nameOf = (id) => products.find(p => p.id === id)?.name ?? 'prodotto eliminato';
  const describeWhen = (r) => (r.category ? `dalla categoria «${r.category}»` : `«${nameOf(r.product)}»`);
  const categories = categoriesInOrder(products);
  const visible = products.filter(p => p.visible);
  const canAdd = draft.when && draft.suggest && !rules.some(r => whenOf(r) === draft.when && r.suggest === Number(draft.suggest)) && draft.when !== `p:${draft.suggest}`;

  const add = () => { setRules(prev => [...prev, toRule(draft.when, Number(draft.suggest))]); setDraft({ when: '', suggest: '' }); };
  const save = async () => {
    setBusy(true);
    try { await fetchWithAuth('/menu-suggestions', { method: 'PUT', body: { rules } }); setSaved(JSON.stringify(rules)); showToast('Suggerimenti salvati', 'success'); }
    catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Suggerimenti ai clienti</h2>
        <p className="text-sm text-[var(--text-muted)]">Una riga discreta, una alla volta, sopra il pulsante dell'ordine: per esempio a chi sceglie un panino propone una birra. Il cliente la può nascondere.</p>
      </div>
      {rules.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] overflow-hidden">
          {rules.map((r, i) => (
            <li key={`${whenOf(r)}-${r.suggest}`} className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--bg-card-2)]">
              <span className="min-w-0 flex-1 text-[var(--text-main)]">A chi sceglie {describeWhen(r)} propone <b className="font-medium">{nameOf(r.suggest)}</b></span>
              <button type="button" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer" aria-label={`Togli il suggerimento ${i + 1}`} onClick={() => setRules(prev => prev.filter((_, j) => j !== i))}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
        <label className="block"><span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Quando sceglie</span>
          <select className={select} value={draft.when} onChange={e => setDraft(d => ({ ...d, when: e.target.value }))}>
            <option value="">Scegli…</option>
            <optgroup label="Una categoria">{categories.map(c => <option key={c} value={`c:${c}`}>{c}</option>)}</optgroup>
            <optgroup label="Un prodotto">{visible.map(p => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
          </select></label>
        <label className="block"><span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Proponi</span>
          <select className={select} value={draft.suggest} onChange={e => setDraft(d => ({ ...d, suggest: e.target.value }))}>
            <option value="">Scegli…</option>
            {visible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <button type="button" className={btn} disabled={!canAdd} onClick={add}><Plus size={15} /> Aggiungi</button>
      </div>
      <div className="flex justify-end"><button type="button" className={btnPrimary} disabled={busy || JSON.stringify(rules) === saved} onClick={save}>{busy ? 'Salvo…' : 'Salva suggerimenti'}</button></div>
    </div>
  );
};

export default MenuSuggestions;
