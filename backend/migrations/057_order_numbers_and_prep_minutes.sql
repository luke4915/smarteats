-- Numerazione unica degli ordini, codice di ritiro dell'asporto e capienza delle fasce in minuti di preparazione.
--
-- 1) Ogni ordine ha un numero (`orders.number`) dentro la sua serata, uguale per tutti i tipi di locale: il progressivo di una
--    cassa (lettera + numero, offline) oppure il progressivo del server. Come lo si scrive (A13, 23) lo decide la visualizzazione.
-- 2) L'asporto accettato riceve un codice di ritiro da dare al cliente (`takeaway_orders.pickup_code`).
-- 3) Il «carico» dei prodotti (0-3 unità) diventa il tempo di preparazione in minuti (`products.prep_minutes`) e la capienza di una
--    fascia diventa «minuti di lavoro»: un'unità valeva una pizza, ora vale 5 minuti, così il comportamento di oggi non cambia.

-- ── 1. Numero dell'ordine ────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS number integer CHECK (number IS NULL OR number > 0);

-- Ordini di una cassa: il numero è il progressivo della cassa (lo stesso che compone il codice)
UPDATE orders SET number = device_seq WHERE number IS NULL AND device_seq IS NOT NULL;
-- Ordini numerati dal server: il codice era una lettera ogni 100 ordini (A1…A100, B1…); il progressivo è lettera × 100 + numero
UPDATE orders SET number = (ascii(left(display_code, 1)) - 65) * 100 + substr(display_code, 2)::int
  WHERE number IS NULL AND display_code ~ '^[A-Z][0-9]{1,3}$';

-- Un numero per cassa e per serata (le comande senza cassa condividono il progressivo del server). L'indice si crea solo se i dati
-- storici lo permettono: un duplicato vecchio non deve bloccare l'aggiornamento (il server numera comunque sotto lock).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM orders WHERE session_id IS NOT NULL AND number IS NOT NULL
    GROUP BY tenant_id, session_id, COALESCE(device_id, 0), number HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_session_source_number
      ON orders (tenant_id, session_id, (COALESCE(device_id, 0)), number) WHERE session_id IS NOT NULL AND number IS NOT NULL;
  ELSE
    RAISE NOTICE 'orders: numeri duplicati nei dati storici, indice uniq_orders_session_source_number non creato';
  END IF;
END $$;

-- ── 2. Codice di ritiro ──────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE takeaway_orders ADD COLUMN IF NOT EXISTS pickup_code text CHECK (pickup_code IS NULL OR pickup_code ~ '^[0-9]{3}$');
-- Un codice è di un solo ordine vivo per giorno di ritiro: due ordini dello stesso giorno non si confondono al banco
CREATE UNIQUE INDEX IF NOT EXISTS uniq_takeaway_orders_pickup_code
  ON takeaway_orders (tenant_id, ((pickup_at AT TIME ZONE 'Europe/Rome')::date), pickup_code)
  WHERE pickup_code IS NOT NULL AND status IN ('requested', 'accepted');

-- ── 3. Minuti di preparazione ────────────────────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'takeaway_load') THEN
    ALTER TABLE products RENAME COLUMN takeaway_load TO prep_minutes;
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_takeaway_load_check;
    UPDATE products SET prep_minutes = prep_minutes * 5;
    ALTER TABLE products ALTER COLUMN prep_minutes SET DEFAULT 5;
    ALTER TABLE products ADD CONSTRAINT products_prep_minutes_check CHECK (prep_minutes >= 0 AND prep_minutes <= 120);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'takeaway_orders' AND column_name = 'load') THEN
    ALTER TABLE takeaway_orders RENAME COLUMN load TO work_minutes;
    ALTER TABLE takeaway_orders DROP CONSTRAINT IF EXISTS takeaway_orders_load_check;
    UPDATE takeaway_orders SET work_minutes = work_minutes * 5;
    ALTER TABLE takeaway_orders ADD CONSTRAINT takeaway_orders_work_minutes_check CHECK (work_minutes >= 0);
    -- La capienza di una fascia (impostazione del locale) passa da unità a minuti con lo stesso fattore. Solo qui, dentro il rename,
    -- così rieseguire la migrazione non la moltiplica due volte.
    UPDATE settings SET value = (value::int * 5)::text WHERE key = 'takeaway_slot_capacity' AND value ~ '^[0-9]+$';
  END IF;
END $$;
