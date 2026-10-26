// Il registro dei movimenti di magazzino (tabella `ingredient_movements`): ogni variazione di un ingrediente passa da qui.
// Scrive i movimenti e aggiorna la quantità in dispensa nella stessa transazione (gli ingredienti si bloccano prima, in
// ordine di id). Il registro non si corregge né si cancella: chi sbaglia scrive un movimento nuovo.

// `movements`: [{ ingredientId, kind, quantityChange, unitCost?, reason?, orderId?, goodsReceiptId?, stockLevelId? }]
// `context`: { sessionId?, userId? }. Con kind: receipt | sale | sale_reversal | usage | waste | adjustment | stock_level.
export async function recordMovements(db, movements, { sessionId = null, userId = null } = {}) {
  const real = movements.filter(m => m.quantityChange !== 0 || m.kind === 'waste');
  if (!real.length) return;

  const delta = new Map();
  for (const m of real) delta.set(m.ingredientId, (delta.get(m.ingredientId) ?? 0) + m.quantityChange);
  const ids = [...delta.keys()].sort((a, b) => a - b);
  await db.query('SELECT 1 FROM ingredients WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);

  const col = (pick) => real.map(pick);
  await db.query(
    `INSERT INTO ingredient_movements (ingredient_id, kind, quantity_change, unit_cost, reason, order_id, goods_receipt_id, stock_level_id, session_id, created_by)
     SELECT * FROM unnest($1::int[], $2::text[], $3::numeric[], $4::numeric[], $5::text[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[])`,
    [col(m => m.ingredientId), col(m => m.kind), col(m => m.quantityChange), col(m => m.unitCost ?? null), col(m => m.reason ?? null),
      col(m => m.orderId ?? null), col(m => m.goodsReceiptId ?? null), col(m => m.stockLevelId ?? null),
      col(() => sessionId), col(() => userId)]);

  await db.query(
    `UPDATE ingredients i SET quantity_on_hand = i.quantity_on_hand + t.delta
     FROM unnest($1::int[], $2::numeric[]) AS t(id, delta) WHERE i.id = t.id`,
    [ids, ids.map(id => delta.get(id))]);
}
