// Controlli di magazzino, scarti, rettifiche e scarico di fine servizio: la logica dei moduli, senza React (provata in controls.test.js).
// Le quantità si scrivono nell'unità comoda (1,5 kg) e al server arrivano sempre nell'unità di base (1500 g): lo fa units.js.
import { parseDecimal, toBaseQuantity, toDisplayQuantity, formatQuantity } from './units.js';
import { addDays } from '../smarteats/reservations/rules.js';
import { addMonths } from '../smarteats/reservations/calendar.js';

export const WASTE_REASONS = [
  { id: 'expired', label: 'Scaduto' },
  { id: 'broken', label: 'Rotto o caduto' },
  { id: 'staff', label: 'Pasto del personale' },
  { id: 'gift', label: 'Omaggio' },
  { id: 'other', label: 'Altro' },
];

const KIND_LABELS = {
  receipt: 'Carico', sale: 'Vendita', sale_reversal: 'Storno', usage: 'Scarico', waste: 'Scarto', adjustment: 'Rettifica', stock_level: 'Controllo',
};
export const kindLabel = (kind) => KIND_LABELS[kind] ?? kind;

// Gli altri motivi che il server scrive da solo nel registro: il tipo di controllo e l'ordine stornato.
const SYSTEM_REASONS = [{ id: 'closing', label: 'Fine servizio' }, { id: 'periodic', label: 'Periodico' }, { id: 'order_canceled', label: 'Ordine stornato' }];

// Il motivo salvato nel registro («expired: scaduta ieri») in testo leggibile («Scaduto · scaduta ieri»).
export function reasonText(reason) {
  if (!reason) return '';
  const [code, ...rest] = reason.split(': ');
  const known = [...WASTE_REASONS, ...SYSTEM_REASONS].find(r => r.id === code);
  if (!known) return reason;
  return rest.length ? `${known.label} · ${rest.join(': ')}` : known.label;
}

// Una riga da compilare per un ingrediente: quantità scritta e unità (quella di base se non si sceglie).
export const blankEntry = (ingredient) => ({ text: '', unit: toDisplayQuantity(ingredient.quantity_on_hand > 0 ? ingredient.quantity_on_hand : 1, ingredient.base_unit).unit });

// Da ciò che si è scritto alla quantità di base, o null se la riga è vuota o non è un numero.
export function entryQuantity(entry) {
  const value = parseDecimal(entry.text);
  return value === null ? null : toBaseQuantity(value, entry.unit);
}

// Quanto manca (negativo) o avanza (positivo) rispetto a ciò che il registro prevedeva; null se la riga non è stata contata.
export function countDifference(entry, expected) {
  const counted = entryQuantity(entry);
  return counted === null ? null : Math.round((counted - expected) * 1000) / 1000;
}

// Un controllo: solo gli ingredienti contati. Senza nessuna riga non si salva.
export function stockLevelPayload(kind, notes, ingredients, entries) {
  const lines = ingredients.flatMap(i => {
    const counted = entries[i.id] ? entryQuantity(entries[i.id]) : null;
    return counted === null || counted < 0 ? [] : [{ ingredient_id: i.id, counted_quantity: counted }];
  });
  return { kind, ...(notes.trim() && { notes: notes.trim() }), lines };
}

// Scarto o rettifica: cosa manca per salvare (null se va bene).
export function movementProblem(form) {
  if (!form.ingredient_id) return 'Scegli l\'ingrediente';
  const quantity = entryQuantity(form);
  if (quantity === null || quantity <= 0) return 'Scrivi una quantità maggiore di zero';
  if (form.type === 'adjustment' && form.note.trim().length < 3) return 'Spiega il motivo della rettifica';
  return null;
}

// Il corpo della richiesta: lo scarto toglie sempre, la rettifica ha il segno scelto (aggiungi o togli).
export function movementPayload(form) {
  const quantity = entryQuantity(form);
  if (form.type === 'waste') return { type: 'waste', ingredient_id: Number(form.ingredient_id), quantity, reason: form.reason, ...(form.note.trim() && { note: form.note.trim() }) };
  return { type: 'adjustment', ingredient_id: Number(form.ingredient_id), quantity_change: form.direction === 'remove' ? -quantity : quantity, note: form.note.trim() };
}

// Lo scarico di fine servizio (locali senza ricette): per ogni ingrediente si scrive quanto è stato usato o quanto è rimasto.
// Le righe vuote si saltano; `mode` dice come leggere ciò che è scritto.
export function usagePayload(mode, ingredients, entries) {
  const lines = ingredients.flatMap(i => {
    const quantity = entries[i.id] ? entryQuantity(entries[i.id]) : null;
    return quantity === null || quantity < 0 ? [] : [{ ingredient_id: i.id, [mode]: quantity }];
  });
  return { lines };
}

// «Manca 250 g», «Avanza 1,5 kg» o «Torna»: la differenza di un conteggio a parole.
export function differenceText(difference, baseUnit) {
  if (difference === null) return '';
  if (difference === 0) return 'Torna';
  return `${difference < 0 ? 'Manca' : 'Avanza'} ${formatQuantity(Math.abs(difference), baseUnit)}`;
}

// Il periodo di un report: un giorno, o il mese intero (`from` e `to` compresi).
export function reportRange(view, date, month) {
  if (view === 'day') return { from: date, to: date };
  return { from: `${month}-01`, to: addDays(`${addMonths(month, 1)}-01`, -1) };
}
