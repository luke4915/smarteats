// I 14 allergeni da dichiarare nel menu (Regolamento UE n. 1169/2011, allegato II). Codici stabili in inglese: sono ciò che si salva e si
// scambia; i nomi che legge una persona stanno nel frontend (utils/allergens.js, nelle lingue dell'app). L'ordine è quello dell'allegato.
export const ALLERGEN_IDS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];

// Un elenco qualsiasi → solo allergeni validi, senza doppioni, nell'ordine dell'allegato.
export const normalizeAllergens = (list) => ALLERGEN_IDS.filter(id => Array.isArray(list) && list.includes(id));
