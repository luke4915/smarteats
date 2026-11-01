-- Il nome di un prodotto nelle altre lingue, per i menu dei clienti: `{ "en": "Sausage sandwich", "de": "…" }`. L'italiano è il nome del prodotto;
-- una lingua senza traduzione mostra il nome italiano. Lingue ammesse: en, de, fr, es (le stesse dell'app, tranne l'italiano).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_translations_check;
ALTER TABLE products ADD CONSTRAINT products_translations_check CHECK (
  jsonb_typeof(translations) = 'object' AND translations - ARRAY['en', 'de', 'fr', 'es'] = '{}'::jsonb);
