// Le righe di una ricetta come si modificano a schermo e come vanno al server. Logica pura, provata in recipeLines.test.js.
//
// A schermo una riga è { key, ref, text, unit }: `ref` dice cosa si usa («i12» = ingrediente 12, «p3» = preparazione 3), `text` è la quantità
// come l'ha scritta chi la modifica e `unit` l'unità scelta. Al server arriva sempre nell'unità di base: { ingredient_id,
// component_preparation_id, quantity }.
import { parseDecimal, toBaseQuantity, toDisplayQuantity, unitsFor } from './units.js';

let counter = 0;
export const blankRow = () => ({ key: `riga-${(counter += 1)}`, ref: '', text: '', unit: 'g' });

const refOf = (line) => (line.ingredient_id != null ? `i${line.ingredient_id}` : `p${line.component_preparation_id}`);

// Ciò che una riga usa: { id, name, base_unit } oppure null se non è ancora scelto (o non esiste più).
export function resolveRef(ref, ingredients, preparations) {
  const id = Number(ref.slice(1));
  return (ref[0] === 'i' ? ingredients : preparations).find(x => x.id === id) ?? null;
}

// Dalle righe del server a quelle da mostrare (la quantità nell'unità più leggibile).
export function rowsFromLines(lines, ingredients, preparations) {
  return lines.map(line => {
    const ref = refOf(line);
    const target = resolveRef(ref, ingredients, preparations);
    const shown = toDisplayQuantity(Number(line.quantity), target?.base_unit ?? 'g');
    return { key: `riga-${(counter += 1)}`, ref, text: String(shown.value).replace('.', ','), unit: shown.unit };
  });
}

// Se si cambia ingrediente, l'unità deve essere una delle sue (non «kg» per un liquido).
export function unitAfterChoosing(ref, currentUnit, ingredients, preparations) {
  const target = ref ? resolveRef(ref, ingredients, preparations) : null;
  const allowed = target ? unitsFor(target.base_unit).map(u => u.id) : [];
  return allowed.length && !allowed.includes(currentUnit) ? allowed[0] : currentUnit;
}

// Cosa manca per poter salvare, o null: ogni riga ha qualcosa di scelto e una quantità maggiore di zero, senza doppioni.
export function recipeProblem(rows, ingredients, preparations) {
  const refs = new Set();
  for (const row of rows) {
    if (!row.ref || !resolveRef(row.ref, ingredients, preparations)) return 'Scegli un ingrediente in ogni riga';
    const quantity = parseDecimal(row.text);
    if (quantity === null || quantity <= 0) return 'Scrivi una quantità maggiore di zero in ogni riga';
    if (refs.has(row.ref)) return 'Un ingrediente è ripetuto: unisci le quantità in una riga sola';
    refs.add(row.ref);
  }
  return null;
}

// Dalle righe a schermo al corpo della richiesta.
export const linesFromRows = (rows) => rows.map(row => ({
  ingredient_id: row.ref[0] === 'i' ? Number(row.ref.slice(1)) : null,
  component_preparation_id: row.ref[0] === 'p' ? Number(row.ref.slice(1)) : null,
  quantity: toBaseQuantity(parseDecimal(row.text), row.unit),
}));

// Le opzioni dei piatti («extra mozzarella», «senza cipolla») usano solo ingredienti e hanno un segno: aggiungono (+) o tolgono (−).
// Sul server è una sola variazione `quantity_change` col segno; a schermo il segno è un interruttore e la quantità resta positiva.
export function optionRowsFromLines(lines, ingredients) {
  return lines.map(line => {
    const shown = toDisplayQuantity(Math.abs(Number(line.quantity_change)), resolveRef(`i${line.ingredient_id}`, ingredients, [])?.base_unit ?? 'g');
    return { key: `riga-${(counter += 1)}`, ref: `i${line.ingredient_id}`, text: String(shown.value).replace('.', ','), unit: shown.unit, sign: line.quantity_change < 0 ? -1 : 1 };
  });
}

export const optionLinesFromRows = (rows) => rows.map(row => ({ ingredient_id: Number(row.ref.slice(1)), quantity_change: (row.sign ?? 1) * toBaseQuantity(parseDecimal(row.text), row.unit) }));
