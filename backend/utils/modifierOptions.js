// Cosa fare alle opzioni di un gruppo quando lo si modifica. Logica pura (tests/modifierOptions.test.js).
//
// Le opzioni mantengono il loro `id` finché esistono: serve perché altro le richiama (gli ingredienti che un'opzione aggiunge o
// toglie dal magazzino). Chi modifica manda per ogni opzione l'`id` che aveva (se già esisteva); senza `id` è un'opzione nuova;
// quelle di prima che non tornano nell'elenco vengono tolte.
import { HttpError } from './httpError.js';

// `existing`: le opzioni del gruppo adesso [{ id }]; `wanted`: quelle richieste [{ id?, name, price_delta }], nell'ordine voluto.
// Ritorna { update: [{ id, name, price_delta, position }], insert: [{ name, price_delta, position }], remove: [id] }.
export function planOptionChanges(existing, wanted) {
  const existingIds = new Set(existing.map(o => o.id));
  const keptIds = new Set();
  const update = [];
  const insert = [];
  wanted.forEach((option, position) => {
    if (option.id === undefined) { insert.push({ name: option.name, price_delta: option.price_delta, position }); return; }
    if (!existingIds.has(option.id)) throw new HttpError(400, 'Opzione non valida', 'INVALID_OPTION');
    if (keptIds.has(option.id)) throw new HttpError(400, 'Opzione ripetuta', 'INVALID_OPTION');
    keptIds.add(option.id);
    update.push({ id: option.id, name: option.name, price_delta: option.price_delta, position });
  });
  return { update, insert, remove: [...existingIds].filter(id => !keptIds.has(id)) };
}

// Applica le modifiche alle opzioni di un gruppo (dentro la transazione della route).
export async function saveGroupOptions(db, groupId, wanted) {
  const { rows: existing } = await db.query('SELECT id FROM modifiers WHERE group_id = $1', [groupId]);
  const { update, insert, remove } = planOptionChanges(existing, wanted);
  if (remove.length) await db.query('DELETE FROM modifiers WHERE group_id = $1 AND id = ANY($2::int[])', [groupId, remove]);
  for (const o of update)
    await db.query('UPDATE modifiers SET name = $1, price_delta = $2, position = $3 WHERE id = $4 AND group_id = $5', [o.name, o.price_delta, o.position, o.id, groupId]);
  for (const o of insert)
    await db.query('INSERT INTO modifiers (group_id, name, price_delta, position) VALUES ($1, $2, $3, $4)', [groupId, o.name, o.price_delta, o.position]);
}
