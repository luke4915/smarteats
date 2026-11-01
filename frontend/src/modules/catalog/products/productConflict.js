// Quando due amministratori lavorano sulla carta insieme: il prodotto che si sta modificando può cambiare (o sparire) sotto le mani
// per il lavoro di un altro. Logica pura, provata in productConflict.test.js. `editing` è il prodotto com'era all'apertura del modulo,
// `live` com'è adesso nell'elenco (che segue gli avvisi del server). La scorta non si confronta: cambia a ogni vendita e non è un conflitto.
const FIELDS = [
  ['name', 'nome'], ['price', 'prezzo'], ['category', 'categoria'], ['color', 'colore'], ['visible', 'visibilità'], ['print_destination', 'dove si prepara'],
  ['course_id', 'portata'], ['prep_minutes', 'tempo di preparazione'], ['vat_rate', 'IVA'], ['portions_reset_rule', 'porzioni'], ['portions_start', 'porzioni'],
];

const same = (a, b) => (a ?? null) === (b ?? null) || (a !== null && b !== null && a !== undefined && b !== undefined && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) === Number(b));

// Ritorna null se non c'è nessun conflitto, altrimenti { removed, fields }: `removed` se il prodotto è stato eliminato, `fields` i nomi
// (senza ripetizioni) di ciò che è cambiato.
export function productConflict(editing, live) {
  if (!editing) return null;
  if (!live) return { removed: true, fields: [] };
  const fields = [...new Set(FIELDS.filter(([key]) => !same(editing[key], live[key])).map(([, label]) => label))];
  return fields.length ? { removed: false, fields } : null;
}
