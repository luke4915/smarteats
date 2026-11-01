-- Allergeni dei prodotti: i 14 allergeni da dichiarare secondo il Regolamento (UE) n. 1169/2011, allegato II. Si salvano come codici
-- (inglesi, stabili) in un elenco; l'elenco vuoto vuol dire «nessuno dichiarato» (non «verificato: nessuno»: lo scrive il locale).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_allergens_check;
ALTER TABLE products ADD CONSTRAINT products_allergens_check CHECK (
  allergens <@ ARRAY['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']::text[]);
