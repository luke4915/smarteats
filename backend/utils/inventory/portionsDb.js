// Le porzioni sul database: l'azzeramento all'apertura del servizio e il salvataggio della regola di un piatto.
// Le regole vere (cosa diventa un piatto) sono in portions.js, pure e provate; qui si legge e si scrive.
import { portionsAtServiceStart, portionsAfterRuleSaved } from './portions.js';

const PORTION_COLUMNS = 'id, visible, stock, stock_enabled, portions_reset_rule, portions_start';

// All'apertura del servizio: ogni piatto che conta le porzioni, o che ha una regola «riparti da N», si rimette come dice la sua regola.
// `rulesEnabled` = il locale ha il modulo magazzino; senza, valgono le regole di prima (tutto torna illimitato).
// Va chiamata dentro la transazione che apre il servizio.
export async function applyServiceStartPortions(db, { rulesEnabled }) {
  const { rows } = await db.query(
    `SELECT ${PORTION_COLUMNS} FROM products WHERE stock_enabled OR portions_reset_rule = 'restart_each_service' ORDER BY id FOR UPDATE`
  );
  if (!rows.length) return;
  const next = rows.map(p => portionsAtServiceStart(rulesEnabled ? p : { ...p, portions_reset_rule: 'unlimited' }));
  await db.query(
    `UPDATE products p SET stock = t.stock, stock_enabled = t.stock_enabled, visible = t.visible
     FROM unnest($1::bigint[], $2::int[], $3::boolean[], $4::boolean[]) AS t(id, stock, stock_enabled, visible)
     WHERE p.id = t.id`,
    [rows.map(p => p.id), next.map(n => n.stock), next.map(n => n.stock_enabled), next.map(n => n.visible)]
  );
}

// Salva la regola di azzeramento di un piatto (e, se serve, aggiorna subito le porzioni di adesso). Ritorna la riga aggiornata, o null.
// Se la regola è la stessa di prima non tocca nulla: chi salva il piatto per un altro motivo (mostra/nascondi) rimanda la regola com'è,
// e il conto delle porzioni di adesso non deve ripartire.
export async function savePortionsRule(db, productId, { rule, start }) {
  const { rows: [current] } = await db.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
  if (!current) return null;
  if (current.portions_reset_rule === rule && current.portions_start === (rule === 'restart_each_service' ? start : null)) return current;
  const now = portionsAfterRuleSaved(current, rule, start);
  const { rows: [saved] } = await db.query(
    `UPDATE products SET portions_reset_rule = $2, portions_start = $3, stock = $4, stock_enabled = $5, visible = $6 WHERE id = $1 RETURNING *`,
    [productId, rule, rule === 'restart_each_service' ? start : null, now.stock, now.stock_enabled, now.visible]
  );
  return saved;
}
