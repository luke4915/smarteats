// Le «uscite» di una comanda: in che ordine escono i piatti dalla cucina e quali escono insieme. È l'anteprima di quello
// che si invia (POST /checks/:id/courses): numeri d'uscita e totali veri li fissa il server.
//
// Ogni riga ha una portata (`course_id`, nullo per bevande e pane) e, se il cameriere l'ha spostata, un'uscita propria
// (`slot`, un numero: le righe con lo stesso numero escono insieme). Senza `slot` vale quello della portata:
// le portate sono in ordine e una portata segnata «insieme alla precedente» ha lo stesso numero di quella prima.
// Bevande e pane escono insieme alla prima portata vera, non da soli.

export const NO_COURSE_NAME = 'Bevande e altro';
const keyOf = (courseId) => courseId ?? 0;

// Una portata del locale che non esiste più o non è attiva si tratta come «senza portata».
export const courseOfProduct = (product, courses) => (courses.some(c => c.id === product.course_id) ? product.course_id : null);

// Numero d'uscita di partenza di ogni portata: cresce a ogni portata, tranne quelle «insieme alla precedente».
export function defaultSlots(courses) {
  const map = new Map();
  let slot = 0;
  courses.forEach((c, i) => {
    if (i === 0 || !c.with_previous) slot += 1;
    map.set(c.id, slot);
  });
  return map;
}

const slotOfLine = (line, slots, nullSlot) => {
  if (line.slot !== undefined && line.slot !== null) return line.slot;
  return slots.get(line.course_id) ?? nullSlot;
};

// L'uscita di bevande e pane: quella della prima portata vera presente nella comanda (o la prima in assoluto).
function nullCourseSlot(cart, slots) {
  const present = cart.filter(l => l.course_id !== null && slots.has(l.course_id)).map(l => slots.get(l.course_id));
  return present.length ? Math.min(...present) : 1;
}

// Il programma della comanda: uscite in ordine, ognuna con le sue portate e le sue righe.
// `uscite[i]` = { index (1..n), raw (il numero grezzo), courses: [{ key, course_id, name, lines }], lines }
export function buildSchedule(cart, courses) {
  const slots = defaultSlots(courses);
  const nullSlot = nullCourseSlot(cart, slots);
  const withSlot = cart.map(line => ({ line, raw: slotOfLine(line, slots, nullSlot) }));
  const raws = [...new Set(withSlot.map(x => x.raw))].sort((a, b) => a - b);
  const order = new Map(courses.map((c, i) => [c.id, i]));

  const uscite = raws.map((raw, i) => {
    const lines = withSlot.filter(x => x.raw === raw).map(x => x.line);
    const keys = [...new Set(lines.map(l => keyOf(l.course_id)))].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : (order.get(a) ?? 99) - (order.get(b) ?? 99)));
    return {
      index: i + 1, raw, lines,
      courses: keys.map(key => ({
        key, course_id: key || null,
        name: key ? (courses.find(c => c.id === key)?.name ?? 'Portata') : NO_COURSE_NAME,
        lines: lines.filter(l => keyOf(l.course_id) === key),
      })),
    };
  });
  return { uscite, slots, nullSlot };
}

// Cosa si manda al server: una voce per portata dentro ogni uscita, col numero d'uscita (1..n).
export const toPayload = (schedule) => schedule.uscite.flatMap(u => u.courses.map(c => ({
  course_id: c.course_id,
  seq: u.index,
  items: c.lines.map(l => ({ id: l.id, name: l.name, quantity: l.quantity, note: l.note, print_destination: l.print_destination, modifiers: (l.modifiers ?? []).map(m => m.id) })),
})));

// Sposta una riga: `to` = { raw } (in un'uscita esistente) | { after: raw } (in una nuova, subito dopo) | { first: true }.
// Ritorna il carrello con la riga che ha un numero d'uscita proprio.
export function moveLine(cart, lineIndex, to, schedule) {
  const raws = schedule.uscite.map(u => u.raw);
  let raw;
  if ('raw' in to) raw = to.raw;
  else if (to.first) raw = raws[0] - 1;
  else {
    const next = raws.find(r => r > to.after);
    raw = next === undefined ? to.after + 1 : (to.after + next) / 2;
  }
  return cart.map((l, i) => (i === lineIndex ? { ...l, slot: raw } : l));
}

// Sposta un'intera uscita prima (-1) o dopo (+1): scambia il posto con quella accanto.
export function moveUscita(cart, schedule, index, direction) {
  const a = schedule.uscite[index], b = schedule.uscite[index + direction];
  if (!a || !b) return cart;
  return cart.map(l => {
    const raw = schedule.uscite.find(u => u.lines.includes(l))?.raw;
    return raw === a.raw ? { ...l, slot: b.raw } : raw === b.raw ? { ...l, slot: a.raw } : l;
  });
}

// Unisce un'uscita a quella prima: le sue righe escono insieme a quelle.
export function mergeWithPrevious(cart, schedule, index) {
  const cur = schedule.uscite[index], prev = schedule.uscite[index - 1];
  if (!cur || !prev) return cart;
  return cart.map(l => (cur.lines.includes(l) ? { ...l, slot: prev.raw } : l));
}

const names = (u) => u.courses.map(c => c.name).join(' + ');

// Il riepilogo che sta sotto al pulsante: cosa esce ora e cosa resta da mandare.
export function sendSummary(schedule, fireFirst) {
  const [first, ...rest] = schedule.uscite;
  if (!first) return { now: null, later: [] };
  return fireFirst
    ? { now: names(first), later: rest.map(names) }
    : { now: null, later: schedule.uscite.map(names) };
}
