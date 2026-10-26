import express from 'express';
import { authenticate, authorizeManager } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tenantScope } from '../middleware/tenantScope.js';
import { inTransaction } from '../db.js';
import logger from '../logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { requireModule } from '../utils/tenantModules.js';
import { requireWarehouseMode } from '../utils/inventory/guards.js';
import { saveRecipeLines } from '../utils/inventory/recipeLinesDb.js';
import { loadRecipeBook } from '../utils/inventory/recipeBookDb.js';
import { needsOfPortion, costCentsOf, portionsFromIngredients } from '../utils/inventory/recipeNeeds.js';
import { HttpError, sendHttpError } from '../utils/httpError.js';
import { idParamsSchema } from '../schemas/common.js';
import { productRecipeSchema, modifierRecipeSchema } from '../schemas/inventorySchema.js';
import { maskReserved } from '../utils/reservedData.js';

// Ricette: quella di un piatto (GET/PUT /products/:id/recipe) e ciò che cambia un'opzione (GET/PUT /modifiers/:id/recipe).
// Le gestiscono amministratore e responsabile (sono costi). Montate su due indirizzi: `products` e `modifiers`.
export const productRecipeRouter = express.Router();
export const modifierRecipeRouter = express.Router();
const guard = [authenticate, requireModule('inventory'), requireWarehouseMode, authorizeManager];

const present = (row) => ({ ingredient_id: row.ingredient_id, component_preparation_id: row.component_preparation_id, quantity: Number(row.quantity) });

// GET /api/products/recipes-summary — per ogni piatto con ricetta: quante righe, costo di una porzione e porzioni possibili.
// Serve all'elenco «Ricette» del magazzino, senza una richiesta per piatto.
productRecipeRouter.get('/recipes-summary', ...guard, tenantScope, maskReserved, async (req, res) => {
  try {
    const book = await loadRecipeBook(req.db);
    res.json([...book.productLines].map(([productId, lines]) => ({
      product_id: productId,
      lines: lines.length,
      cost_cents_per_portion: costCentsOf(needsOfPortion(productId, [], book), book),
      portions_from_ingredients: portionsFromIngredients(productId, book),
    })));
  } catch (err) {
    logger.error({ err }, 'Errore GET /api/products/recipes-summary');
    res.status(500).json({ error: 'Errore caricamento ricette' });
  }
});

// La ricetta di un piatto, con il costo di una porzione (al costo medio di adesso) e quante porzioni permette la dispensa.
productRecipeRouter.get('/:id/recipe', ...guard, validate({ params: idParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    const { rows: product } = await req.db.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
    if (!product.length) throw new HttpError(404, 'Prodotto non trovato');
    const { rows } = await req.db.query('SELECT ingredient_id, component_preparation_id, quantity FROM recipe_lines WHERE product_id = $1 ORDER BY id', [req.params.id]);
    const book = await loadRecipeBook(req.db);
    const needs = needsOfPortion(Number(req.params.id), [], book);
    res.json({ lines: rows.map(present), cost_cents_per_portion: costCentsOf(needs, book), portions_from_ingredients: portionsFromIngredients(Number(req.params.id), book) });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore GET /api/products/:id/recipe');
    res.status(500).json({ error: 'Errore caricamento ricetta' });
  }
});

productRecipeRouter.put('/:id/recipe', ...guard, validate({ params: idParamsSchema, body: productRecipeSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    await inTransaction(req.db, async (tx) => {
      if (!(await tx.query('SELECT 1 FROM products WHERE id = $1 FOR UPDATE', [req.params.id])).rowCount) throw new HttpError(404, 'Prodotto non trovato');
      await saveRecipeLines(tx, { productId: Number(req.params.id) }, req.body.lines);
    });
    await logAudit(req.db, req.user.id, 'UPDATE_RECIPE', { productId: Number(req.params.id), lines: req.body.lines.length });
    res.json({ lines: req.body.lines });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/products/:id/recipe');
    res.status(500).json({ error: 'Errore salvataggio ricetta' });
  }
});

// Cosa cambia un'opzione: se scala il magazzino e quali ingredienti aggiunge (+) o toglie (−).
modifierRecipeRouter.get('/:id/recipe', ...guard, validate({ params: idParamsSchema }), tenantScope, maskReserved, async (req, res) => {
  try {
    const { rows: [modifier] } = await req.db.query('SELECT id, affects_stock FROM modifiers WHERE id = $1', [req.params.id]);
    if (!modifier) throw new HttpError(404, 'Opzione non trovata');
    const { rows } = await req.db.query('SELECT ingredient_id, quantity_change FROM modifier_recipe_lines WHERE modifier_id = $1 ORDER BY id', [req.params.id]);
    res.json({ affects_stock: modifier.affects_stock, lines: rows.map(r => ({ ingredient_id: r.ingredient_id, quantity_change: Number(r.quantity_change) })) });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore GET /api/modifiers/:id/recipe');
    res.status(500).json({ error: 'Errore caricamento opzione' });
  }
});

modifierRecipeRouter.put('/:id/recipe', ...guard, validate({ params: idParamsSchema, body: modifierRecipeSchema }), tenantScope, maskReserved, async (req, res) => {
  const { affects_stock: affectsStock, lines } = req.body;
  try {
    await inTransaction(req.db, async (tx) => {
      if (!(await tx.query('UPDATE modifiers SET affects_stock = $1 WHERE id = $2 RETURNING id', [affectsStock, req.params.id])).rowCount) throw new HttpError(404, 'Opzione non trovata');
      const ids = lines.map(l => l.ingredient_id);
      if (ids.length && (await tx.query('SELECT id FROM ingredients WHERE id = ANY($1::int[])', [ids])).rowCount !== ids.length) throw new HttpError(400, 'Ingrediente non valido', 'INVALID_INGREDIENT');
      await tx.query('DELETE FROM modifier_recipe_lines WHERE modifier_id = $1', [req.params.id]);
      for (const l of lines) await tx.query('INSERT INTO modifier_recipe_lines (modifier_id, ingredient_id, quantity_change) VALUES ($1, $2, $3)', [req.params.id, l.ingredient_id, l.quantity_change]);
    });
    await logAudit(req.db, req.user.id, 'UPDATE_MODIFIER_RECIPE', { modifierId: Number(req.params.id), affectsStock, lines: lines.length });
    res.json({ affects_stock: affectsStock, lines });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logger.error({ err }, 'Errore PUT /api/modifiers/:id/recipe');
    res.status(500).json({ error: 'Errore salvataggio opzione' });
  }
});
