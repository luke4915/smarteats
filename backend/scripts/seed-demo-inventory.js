// Il magazzino del locale demo: ingredienti, preparazioni, fornitori, carichi di merce, ricette di ogni piatto e opzioni.
// Lo usa seed-demo.js dopo aver creato la carta e prima delle serate: la dispensa arriva da veri carichi (stesso percorso
// delle API), così le vendite della demo la scalano davvero e i costi medi sono credibili.

// [nome, unità, resa %, scorta minima, fornitore, confezione, unità di base per confezione, prezzo (centesimi, senza IVA), IVA %, confezioni del primo carico]
const INGREDIENTS = [
  ['Farina 00', 'g', 100, 5000, 'Rossi Alimentari', 'Sacco da 25 kg', 25000, 2500, 4, 6],
  ['Spaghetti', 'g', 100, 3000, 'Rossi Alimentari', 'Cartone 12 pacchi da 500 g', 6000, 1080, 10, 4],
  ['Tagliatelle all\'uovo', 'g', 100, 2000, 'Rossi Alimentari', 'Cartone 10 pacchi da 500 g', 5000, 2400, 10, 3],
  ['Gnocchi di patate', 'g', 100, 2000, 'Rossi Alimentari', 'Cartone 10 pacchi da 500 g', 5000, 1900, 10, 3],
  ['Riso carnaroli', 'g', 100, 2000, 'Rossi Alimentari', 'Sacco da 5 kg', 5000, 1250, 4, 3],
  ['Pomodoro pelato', 'g', 100, 6000, 'Rossi Alimentari', 'Cartone 3 lattine da 2,5 kg', 7500, 1050, 10, 8],
  ['Olio extravergine', 'ml', 100, 2000, 'Rossi Alimentari', 'Latta da 5 l', 5000, 4500, 4, 4],
  ['Pangrattato', 'g', 100, 1000, 'Rossi Alimentari', 'Sacco da 5 kg', 5000, 900, 4, 2],
  ['Savoiardi', 'g', 100, 500, 'Rossi Alimentari', 'Cartone da 2 kg', 2000, 1400, 10, 2],
  ['Zucchero', 'g', 100, 1000, 'Rossi Alimentari', 'Sacco da 10 kg', 10000, 1300, 4, 1],
  ['Caffè in grani', 'g', 100, 1000, 'Rossi Alimentari', 'Sacco da 1 kg', 1000, 1650, 10, 6],
  ['Cacao amaro', 'g', 100, 200, 'Rossi Alimentari', 'Barattolo da 500 g', 500, 650, 10, 1],
  ['Lievito di birra', 'g', 100, 100, 'Rossi Alimentari', 'Panetto da 500 g', 500, 300, 10, 1],
  ['Pane casereccio', 'g', 100, 1000, 'Rossi Alimentari', 'Cesta da 5 kg', 5000, 1500, 4, 2],
  ['Mozzarella fior di latte', 'g', 100, 3000, 'Caseificio Bianchi', 'Busta da 1 kg', 1000, 680, 10, 25],
  ['Mozzarella di bufala', 'g', 100, 1500, 'Caseificio Bianchi', 'Cartone da 2 kg', 2000, 2400, 10, 4],
  ['Gorgonzola', 'g', 100, 1000, 'Caseificio Bianchi', 'Forma da 1,5 kg', 1500, 1350, 10, 4],
  ['Parmigiano Reggiano', 'g', 100, 800, 'Caseificio Bianchi', 'Spicchio da 1 kg', 1000, 1650, 10, 4],
  ['Mascarpone', 'g', 100, 500, 'Caseificio Bianchi', 'Vaschetta da 500 g', 500, 380, 10, 6],
  ['Panna fresca', 'ml', 100, 500, 'Caseificio Bianchi', 'Bottiglia da 1 l', 1000, 320, 10, 4],
  ['Burro', 'g', 100, 500, 'Caseificio Bianchi', 'Panetto da 250 g', 250, 280, 10, 8],
  ['Burrata', 'pc', 100, 8, 'Caseificio Bianchi', 'Confezione da 4 pezzi', 4, 760, 10, 6],
  ['Manzo (tagliata e carpaccio)', 'g', 80, 3000, 'Macelleria Verdi', 'Pezzo da 3 kg', 3000, 5400, 10, 4],
  ['Macinato di manzo', 'g', 100, 2000, 'Macelleria Verdi', 'Vaschetta da 1 kg', 1000, 1100, 10, 6],
  ['Lombata di vitello', 'g', 90, 1500, 'Macelleria Verdi', 'Pezzo da 2 kg', 2000, 3800, 10, 4],
  ['Salame piccante', 'g', 100, 500, 'Macelleria Verdi', 'Stecca da 1 kg', 1000, 1450, 10, 3],
  ['Prosciutto cotto', 'g', 100, 500, 'Macelleria Verdi', 'Pezzo da 3 kg', 3000, 3600, 10, 1],
  ['Prosciutto crudo', 'g', 100, 500, 'Macelleria Verdi', 'Pezzo da 7 kg', 7000, 12600, 10, 1],
  ['Salumi e formaggi misti', 'g', 100, 500, 'Macelleria Verdi', 'Vassoio da 1 kg', 1000, 1900, 10, 3],
  ['Patate', 'g', 85, 5000, 'Ortofrutta Neri', 'Sacco da 25 kg', 25000, 1800, 4, 2],
  ['Insalata mista', 'g', 90, 1000, 'Ortofrutta Neri', 'Cassetta da 5 kg', 5000, 1500, 4, 2],
  ['Verdure per griglia', 'g', 90, 2000, 'Ortofrutta Neri', 'Cassetta da 5 kg', 5000, 1700, 4, 2],
  ['Funghi champignon', 'g', 95, 1000, 'Ortofrutta Neri', 'Cassetta da 3 kg', 3000, 1500, 4, 3],
  ['Funghi porcini', 'g', 90, 300, 'Ortofrutta Neri', 'Vaschetta da 500 g', 500, 1400, 4, 3],
  ['Pomodorini', 'g', 100, 1500, 'Ortofrutta Neri', 'Cassetta da 3 kg', 3000, 1200, 4, 3],
  ['Frutti di bosco', 'g', 100, 500, 'Ortofrutta Neri', 'Vaschetta da 500 g', 500, 650, 4, 3],
  ['Sorbetto al limone', 'g', 100, 500, 'Ortofrutta Neri', 'Vaschetta da 2,5 kg', 2500, 1800, 10, 2],
  ['Olive nere', 'g', 100, 300, 'Ortofrutta Neri', 'Barattolo da 1 kg', 1000, 650, 10, 1],
  ['Vongole', 'g', 100, 1500, 'Pescheria Azzurra', 'Retina da 2 kg', 2000, 2200, 10, 6],
  ['Pesce per frittura', 'g', 70, 2000, 'Pescheria Azzurra', 'Cassetta da 3 kg', 3000, 4500, 10, 3],
  ['Acqua naturale 0,5 l', 'pc', 100, 48, 'Bevande Sud', 'Cartone da 24 bottiglie', 24, 960, 10, 6],
  ['Acqua frizzante 0,5 l', 'pc', 100, 48, 'Bevande Sud', 'Cartone da 24 bottiglie', 24, 960, 10, 6],
  ['Coca-Cola lattina', 'pc', 100, 48, 'Bevande Sud', 'Cartone da 24 lattine', 24, 1680, 22, 5],
  ['Birra media', 'pc', 100, 48, 'Bevande Sud', 'Cassa da 24 bottiglie', 24, 2400, 22, 5],
  ['Vino della casa', 'ml', 100, 6000, 'Bevande Sud', 'Cartone da 6 bottiglie da 1 l', 6000, 1800, 22, 8],
  ['Vermentino', 'ml', 100, 3000, 'Bevande Sud', 'Cartone da 6 bottiglie da 75 cl', 4500, 3600, 22, 4],
  ['Amaro', 'ml', 100, 1000, 'Bevande Sud', 'Bottiglia da 70 cl', 700, 1200, 22, 4],
];

// Ricarichi dopo qualche giorno, a un prezzo diverso: il costo medio non coincide più col primo prezzo
const TOP_UPS = [['Mozzarella fior di latte', 10, 1.06], ['Olio extravergine', 1, 1.1], ['Manzo (tagliata e carpaccio)', 2, 1.12], ['Pomodoro pelato', 2, 1.04]];

// Preparazioni riusabili: [nome, unità, quantità ottenuta, righe [ingrediente, quantità]]
const PREPARATIONS = [
  ['Sugo di pomodoro', 'g', 1000, [['Pomodoro pelato', 900], ['Olio extravergine', 30]]],
  ['Impasto per pizza', 'g', 1000, [['Farina 00', 600], ['Lievito di birra', 3], ['Olio extravergine', 20]]],
  ['Ragù di manzo', 'g', 1000, [['Macinato di manzo', 600], ['Pomodoro pelato', 300], ['Olio extravergine', 30]]],
];

// Ricetta di ogni piatto, per una porzione. «P:» davanti al nome = una preparazione.
const RECIPES = {
  'Bruschetta al pomodoro': [['Pane casereccio', 60], ['Pomodorini', 80], ['Olio extravergine', 8]],
  'Tagliere di salumi e formaggi': [['Salumi e formaggi misti', 180]],
  'Carpaccio di manzo': [['Manzo (tagliata e carpaccio)', 100], ['Parmigiano Reggiano', 15], ['Olio extravergine', 8]],
  'Burrata e pomodorini': [['Burrata', 1], ['Pomodorini', 100], ['Olio extravergine', 8]],
  'Margherita': [['P:Impasto per pizza', 250], ['P:Sugo di pomodoro', 80], ['Mozzarella fior di latte', 120]],
  'Diavola': [['P:Impasto per pizza', 250], ['P:Sugo di pomodoro', 80], ['Mozzarella fior di latte', 100], ['Salame piccante', 60]],
  'Quattro formaggi': [['P:Impasto per pizza', 250], ['Mozzarella fior di latte', 80], ['Gorgonzola', 50], ['Parmigiano Reggiano', 30]],
  'Capricciosa': [['P:Impasto per pizza', 250], ['P:Sugo di pomodoro', 80], ['Mozzarella fior di latte', 100], ['Prosciutto cotto', 50], ['Funghi champignon', 50], ['Olive nere', 20]],
  'Bufalina': [['P:Impasto per pizza', 250], ['P:Sugo di pomodoro', 80], ['Mozzarella di bufala', 120]],
  'Spaghetti alle vongole': [['Spaghetti', 100], ['Vongole', 300], ['Olio extravergine', 15]],
  'Tagliatelle al ragù': [['Tagliatelle all\'uovo', 120], ['P:Ragù di manzo', 150], ['Parmigiano Reggiano', 10]],
  'Risotto ai funghi porcini': [['Riso carnaroli', 90], ['Funghi porcini', 60], ['Burro', 15], ['Parmigiano Reggiano', 20]],
  'Gnocchi al gorgonzola': [['Gnocchi di patate', 200], ['Gorgonzola', 70], ['Panna fresca', 40]],
  'Tagliata di manzo': [['Manzo (tagliata e carpaccio)', 220], ['Olio extravergine', 8], ['Parmigiano Reggiano', 15]],
  'Frittura di paranza': [['Pesce per frittura', 250], ['Farina 00', 30], ['Olio extravergine', 60]],
  'Cotoletta alla milanese': [['Lombata di vitello', 200], ['Pangrattato', 50], ['Burro', 30]],
  'Patate al forno': [['Patate', 250], ['Olio extravergine', 15]],
  'Insalata mista': [['Insalata mista', 120], ['Pomodorini', 40], ['Olio extravergine', 8]],
  'Verdure grigliate': [['Verdure per griglia', 200], ['Olio extravergine', 12]],
  'Tiramisù': [['Mascarpone', 80], ['Savoiardi', 40], ['Caffè in grani', 6], ['Cacao amaro', 3], ['Zucchero', 15]],
  'Panna cotta ai frutti di bosco': [['Panna fresca', 120], ['Zucchero', 15], ['Frutti di bosco', 40]],
  'Sorbetto al limone': [['Sorbetto al limone', 120]],
  'Acqua naturale': [['Acqua naturale 0,5 l', 1]],
  'Acqua frizzante': [['Acqua frizzante 0,5 l', 1]],
  'Coca-Cola': [['Coca-Cola lattina', 1]],
  'Birra media': [['Birra media', 1]],
  'Vino della casa (caraffa)': [['Vino della casa', 500]],
  'Calice di Vermentino': [['Vermentino', 150]],
  'Caffè': [['Caffè in grani', 7]],
  'Amaro': [['Amaro', 40]],
};

// Cosa aggiungono le opzioni delle pizze: [gruppo, opzione, ingrediente, quantità] (null = non scala il magazzino)
const OPTION_RECIPES = [['Aggiunte', 'Bufala', 'Mozzarella di bufala', 80], ['Aggiunte', 'Prosciutto crudo', 'Prosciutto crudo', 40], ['Aggiunte', 'Funghi', 'Funghi champignon', 50],
  ['Aggiunte', 'Senza lattosio', null, 0], ['Condimento', 'Senza glutine', null, 0]];

const SUPPLIERS = [['Rossi Alimentari', '+39 06 555 0101', 'ordini@rossialimentari.example', 'IT01234567890'], ['Caseificio Bianchi', '+39 06 555 0102', null, 'IT09876543210'],
  ['Macelleria Verdi', '+39 06 555 0103', null, 'IT01112223334'], ['Ortofrutta Neri', '+39 06 555 0104', null, 'IT05556667778'],
  ['Pescheria Azzurra', '+39 06 555 0105', null, 'IT03334445556'], ['Bevande Sud', '+39 06 555 0106', 'info@bevandesud.example', 'IT07778889990']];

export async function seedInventory({ api, admin, tenantId, products, dayString }) {
  const ingredientId = {};
  for (const [name, unit, yieldPercent, reorder] of INGREDIENTS)
    ingredientId[name] = (await api.post('/ingredients', { name, base_unit: unit, yield_percent: yieldPercent, reorder_level: reorder })).id;
  const preparationId = {};
  for (const [name, unit, output, lines] of PREPARATIONS)
    preparationId[name] = (await api.post('/preparations', { name, base_unit: unit, output_quantity: output, lines: lines.map(([n, q]) => ({ ingredient_id: ingredientId[n], quantity: q })) })).id;

  // Fornitori e carichi: il primo riempie la dispensa, il secondo ricarica alcuni ingredienti a un altro prezzo
  const supplierId = {};
  for (const [name, phone, email, vat] of SUPPLIERS) supplierId[name] = (await api.post('/suppliers', { name, phone, email, vat_number: vat })).id;
  const line = (row, packages, priceFactor = 1) => {
    const [name, , , , , packaging, units, price, vat] = row;
    return { ingredient_id: ingredientId[name], quantity: packages, purchase_unit_name: packaging, base_units_per_purchase_unit: units, unit_cost_cents: Math.round(price * priceFactor), vat_rate: vat };
  };
  let delivery = 1020;
  for (const supplier of SUPPLIERS.map(s => s[0])) {
    const rows = INGREDIENTS.filter(r => r[4] === supplier);
    await api.post('/goods-receipts', { supplier_id: supplierId[supplier], received_on: dayString(-10), document_number: `DDT ${delivery += 1}`, lines: rows.map(r => line(r, r[9])) });
  }
  for (const [name, packages, factor] of TOP_UPS) {
    const row = INGREDIENTS.find(r => r[0] === name);
    await api.post('/goods-receipts', { supplier_id: supplierId[row[4]], received_on: dayString(-3), document_number: `DDT ${delivery += 1}`, lines: [line(row, packages, factor)] });
  }
  // I movimenti prendono la data del carico (la demo racconta dieci giorni di lavoro)
  await admin.query(`UPDATE ingredient_movements m SET created_at = r.received_on + time '08:30' FROM goods_receipts r WHERE m.goods_receipt_id = r.id AND m.tenant_id = $1`, [tenantId]);
  await admin.query(`UPDATE goods_receipts SET created_at = received_on + time '08:30' WHERE tenant_id = $1`, [tenantId]);

  // Ricette dei piatti
  for (const [dish, lines] of Object.entries(RECIPES)) {
    await api.put(`/products/${products[dish]}/recipe`, { lines: lines.map(([n, q]) => (n.startsWith('P:')
      ? { component_preparation_id: preparationId[n.slice(2)], quantity: q } : { ingredient_id: ingredientId[n], quantity: q })) });
  }

  // Opzioni che aggiungono ingredienti
  const groups = await api.get('/modifier-groups');
  for (const [group, option, ingredient, quantity] of OPTION_RECIPES) {
    const modifier = groups.find(g => g.name === group)?.options.find(o => o.name === option);
    if (!modifier) continue;
    await api.put(`/modifiers/${modifier.id}/recipe`, ingredient
      ? { affects_stock: true, lines: [{ ingredient_id: ingredientId[ingredient], quantity_change: quantity }] }
      : { affects_stock: false, lines: [] });
  }
  return { ingredientId };
}

// Alla fine della demo: qualche ingrediente sotto scorta minima e uno esaurito, per mostrare gli avvisi
export async function finishInventoryDemo({ admin, tenantId, ingredientId }) {
  const setOnHand = async (name, quantity) => {
    const { rows: [i] } = await admin.query('SELECT quantity_on_hand FROM ingredients WHERE id = $1', [ingredientId[name]]);
    await admin.query(`INSERT INTO ingredient_movements (tenant_id, ingredient_id, kind, quantity_change, reason) VALUES ($1, $2, 'adjustment', $3, 'Conteggio di prova')`, [tenantId, ingredientId[name], quantity - Number(i.quantity_on_hand)]);
    await admin.query('UPDATE ingredients SET quantity_on_hand = $2 WHERE id = $1', [ingredientId[name], quantity]);
  };
  await setOnHand('Vongole', 900);                 // sotto la scorta minima (1500 g): «da riordinare»
  await setOnHand('Funghi porcini', 150);
  await admin.query('UPDATE ingredients SET marked_out = true WHERE id = $1', [ingredientId.Burrata]);   // segnata esaurita dalla cucina
}
