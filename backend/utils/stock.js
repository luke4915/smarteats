// Stock dei prodotti. Si conta solo per i prodotti con stock_enabled = true e
// stock valorizzato; con stock_enabled = false (o stock NULL) la disponibilità è illimitata.

// Somma le quantità per prodotto: un ordine può avere più righe dello stesso
// prodotto (es. una venduta e una in omaggio).
export function sumQuantitiesByProduct(items) {
  const totals = new Map();
  for (const { id, quantity } of items) totals.set(id, (totals.get(id) || 0) + quantity);
  return totals;
}

// Blocca (FOR UPDATE) i prodotti a stock limitato coinvolti nell'ordine e
// ritorna quelli senza disponibilità sufficiente. Va chiamata dentro una transazione;
// l'ordinamento per id evita deadlock tra ordini concorrenti.
export async function lockAndFindShortages(db, totals) {
  const { rows } = await db.query(
    `SELECT id, name, stock FROM products
     WHERE id = ANY($1) AND stock_enabled AND stock IS NOT NULL
     ORDER BY id FOR UPDATE`,
    [[...totals.keys()]]
  );
  return rows.filter(p => p.stock < totals.get(p.id));
}

// Applica la variazione di stock (sign = -1 scala, +1 ripristina) ai soli prodotti
// a stock limitato, senza scendere sotto 0 (un ordine offline sincronizzato in
// ritardo è già stato venduto e non si rifiuta). Un prodotto che arriva a 0 **resta in carta**, in grigio e «Esaurito»
// (la visibilità la decide solo chi gestisce la carta): così chi ordina vede che esiste e quando torna disponibile.
// Ritorna { id, stock, stock_enabled, visible } dei prodotti aggiornati.
export async function applyStockChange(db, totals, sign) {
  const { rows } = await db.query(
    `UPDATE products p
     SET stock = GREATEST(p.stock + $3 * t.qty, 0)
     FROM unnest($1::int[], $2::int[]) AS t(id, qty)
     WHERE p.id = t.id AND p.stock_enabled AND p.stock IS NOT NULL
     RETURNING p.id, p.stock, p.stock_enabled, p.visible`,
    [[...totals.keys()], [...totals.values()], sign]
  );
  return rows;
}
