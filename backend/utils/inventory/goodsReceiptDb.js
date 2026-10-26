// Il carico di merce sul database: scrive il carico e le sue righe, fa salire la dispensa (un movimento `receipt` per riga),
// aggiorna il costo medio ponderato e ricorda il prezzo nel listino del fornitore, così il carico dopo parte già compilato.
// Va chiamata dentro una transazione.
import { HttpError } from '../httpError.js';
import { recordMovements } from './ingredientMovementsDb.js';
import { nextAverageCost, lineAmounts, receiptTotals } from './costing.js';

export async function createGoodsReceipt(db, { userId, supplierId, receivedOn, documentNumber, notes, lines }) {
  const { rows: [supplier] } = await db.query('SELECT id FROM suppliers WHERE id = $1 AND active', [supplierId]);
  if (!supplier) throw new HttpError(400, 'Fornitore non valido', 'INVALID_SUPPLIER');

  // Gli ingredienti si bloccano in ordine di id: due carichi insieme non si incastrano
  const ids = [...new Set(lines.map(l => l.ingredient_id))].sort((a, b) => a - b);
  const { rows: ingredients } = await db.query(
    'SELECT id, quantity_on_hand, weighted_average_cost FROM ingredients WHERE id = ANY($1::int[]) AND active ORDER BY id FOR UPDATE', [ids]);
  if (ingredients.length !== ids.length) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
  const state = new Map(ingredients.map(i => [i.id, { onHand: Number(i.quantity_on_hand), averageCost: Number(i.weighted_average_cost) }]));

  const priced = lines.map(l => ({ ...l, ...lineAmounts({ quantity: l.quantity, baseUnitsPerPurchaseUnit: l.base_units_per_purchase_unit, unitCostCents: l.unit_cost_cents }), vatRate: l.vat_rate }));
  const { netCents } = receiptTotals(priced);
  const { rows: [receipt] } = await db.query(
    `INSERT INTO goods_receipts (supplier_id, received_on, document_number, notes, total_cost_cents, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [supplierId, receivedOn, documentNumber, notes, netCents, userId]);

  const movements = [];
  for (const l of priced) {
    await db.query(
      `INSERT INTO goods_receipt_lines (goods_receipt_id, ingredient_id, purchase_unit_name, quantity, base_quantity, unit_cost_cents, vat_rate, line_cost_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [receipt.id, l.ingredient_id, l.purchase_unit_name, l.quantity, l.baseQuantity, l.unit_cost_cents, l.vatRate, l.lineCostCents]);

    const unitCost = l.baseQuantity > 0 ? l.lineCostCents / l.baseQuantity : 0;
    const current = state.get(l.ingredient_id);
    current.averageCost = nextAverageCost({ onHand: current.onHand, averageCost: current.averageCost, addedQuantity: l.baseQuantity, addedUnitCost: unitCost });
    current.onHand += l.baseQuantity;
    movements.push({ ingredientId: l.ingredient_id, kind: 'receipt', quantityChange: l.baseQuantity, unitCost, goodsReceiptId: receipt.id });

    // Il listino ricorda l'ultimo prezzo e la confezione di questo fornitore per questo ingrediente
    await db.query(
      `INSERT INTO supplier_ingredients (supplier_id, ingredient_id, purchase_unit_name, base_units_per_purchase_unit, unit_cost_cents, vat_rate) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (supplier_id, ingredient_id) DO UPDATE SET purchase_unit_name = EXCLUDED.purchase_unit_name,
         base_units_per_purchase_unit = EXCLUDED.base_units_per_purchase_unit, unit_cost_cents = EXCLUDED.unit_cost_cents, vat_rate = EXCLUDED.vat_rate`,
      [supplierId, l.ingredient_id, l.purchase_unit_name, l.base_units_per_purchase_unit, l.unit_cost_cents, l.vatRate]);
  }
  // La merce è arrivata: un ingrediente che la cucina aveva segnato «esaurito» torna disponibile
  for (const [ingredientId, { averageCost }] of state)
    await db.query('UPDATE ingredients SET weighted_average_cost = $2, marked_out = false WHERE id = $1', [ingredientId, averageCost]);

  await recordMovements(db, movements, { userId });
  return { id: receipt.id, totalCostCents: netCents };
}
