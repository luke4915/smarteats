-- Magazzino (modulo `inventory`): scorte, ingredienti, ricette, fornitori, carichi di merce, controlli di magazzino.
-- Disegno e glossario in docs/design-magazzino.md. Un'unica migrazione per tutto il modello: il codice arriva a fasi.
--
-- Tre modalità, scelte dal master per locale: spento (il modulo non c'è), `portions` (conteggio per piatto, azzerato a ogni
-- servizio) e `warehouse` (ingredienti, ricette, fornitori, costi). Gli ingredienti si scalano `recipes` (dalle ricette)
-- oppure `simple` (scarico semplificato, senza ricette).

-- ── Il locale: modalità e modo di scalare ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS inventory_mode text CHECK (inventory_mode IN ('portions', 'warehouse')),
  ADD COLUMN IF NOT EXISTS inventory_depletion text NOT NULL DEFAULT 'recipes' CHECK (inventory_depletion IN ('recipes', 'simple'));

-- ── Porzioni dei piatti ─────────────────────────────────────────────────────────────────────────────────────────────────
-- `stock` e `stock_enabled` restano le porzioni rimaste adesso; la regola dice cosa succede all'apertura del servizio.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS portions_reset_rule text NOT NULL DEFAULT 'unlimited' CHECK (portions_reset_rule IN ('restart_each_service', 'carry_over', 'unlimited')),
  ADD COLUMN IF NOT EXISTS portions_start integer CHECK (portions_start IS NULL OR portions_start > 0),
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_restart_needs_start') THEN
    ALTER TABLE products ADD CONSTRAINT products_restart_needs_start CHECK (portions_reset_rule <> 'restart_each_service' OR portions_start IS NOT NULL);
  END IF;
END $$;

-- Un'opzione di un piatto può togliere ingredienti dal magazzino (acceso di partenza, si spegne per ogni opzione)
ALTER TABLE modifiers ADD COLUMN IF NOT EXISTS affects_stock boolean NOT NULL DEFAULT true;

-- Costo teorico della riga al momento della vendita, in centesimi (vuoto = non calcolato): i margini non si ricalcolano dopo
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_cents integer CHECK (cost_cents IS NULL OR cost_cents >= 0);

-- ── Ingredienti, fornitori, preparazioni ────────────────────────────────────────────────────────────────────────────────
-- Quantità sempre nell'unità di base: g (grammi), ml (millilitri), pc (pezzi). `weighted_average_cost` è in centesimi per
-- unità di base (con decimali), senza IVA. `quantity_on_hand` si aggiorna insieme al registro dei movimenti.
CREATE TABLE IF NOT EXISTS ingredients (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  name                  TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  base_unit             TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'pc')),
  yield_percent         NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (yield_percent > 0 AND yield_percent <= 100),
  reorder_level         NUMERIC(14,3) CHECK (reorder_level IS NULL OR reorder_level >= 0),
  quantity_on_hand      NUMERIC(14,3) NOT NULL DEFAULT 0,
  weighted_average_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (weighted_average_cost >= 0),
  marked_out            BOOLEAN NOT NULL DEFAULT false,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ingredients_name ON ingredients (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  name       TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  phone      TEXT,
  email      TEXT,
  vat_number TEXT,
  notes      TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_suppliers_name ON suppliers (tenant_id, lower(name));

-- Cosa vende un fornitore e a che prezzo: «cassa da 12 bottiglie» = 12 000 ml a 18,00 € (senza IVA)
CREATE TABLE IF NOT EXISTS supplier_ingredients (
  id                           SERIAL PRIMARY KEY,
  tenant_id                    INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  supplier_id                  INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  ingredient_id                INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  purchase_unit_name           TEXT NOT NULL CHECK (length(btrim(purchase_unit_name)) BETWEEN 1 AND 40),
  base_units_per_purchase_unit NUMERIC(14,3) NOT NULL CHECK (base_units_per_purchase_unit > 0),
  unit_cost_cents              INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  vat_rate                     NUMERIC(5,2) CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  UNIQUE (supplier_id, ingredient_id)
);

-- Preparazione riusabile (il sugo base): una «ricetta» con una quantità prodotta, usata dai piatti come un ingrediente
CREATE TABLE IF NOT EXISTS preparations (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  name            TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  base_unit       TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'pc')),
  output_quantity NUMERIC(14,3) NOT NULL CHECK (output_quantity > 0),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_preparations_name ON preparations (tenant_id, lower(name));

-- ── Ricette ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Una riga appartiene a un piatto O a una preparazione, e usa un ingrediente O un'altra preparazione (un solo proprietario,
-- un solo componente). La quantità è nell'unità di base di ciò che si usa.
CREATE TABLE IF NOT EXISTS recipe_lines (
  id                       SERIAL PRIMARY KEY,
  tenant_id                INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  product_id               BIGINT REFERENCES products(id) ON DELETE CASCADE,
  preparation_id           INTEGER REFERENCES preparations(id) ON DELETE CASCADE,
  ingredient_id            INTEGER REFERENCES ingredients(id),
  component_preparation_id INTEGER REFERENCES preparations(id),
  quantity                 NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  CHECK ((product_id IS NOT NULL)::int + (preparation_id IS NOT NULL)::int = 1),
  CHECK ((ingredient_id IS NOT NULL)::int + (component_preparation_id IS NOT NULL)::int = 1)
);

-- Cosa cambia un'opzione: ingrediente in più (positivo) o in meno (negativo, «senza cipolla»)
CREATE TABLE IF NOT EXISTS modifier_recipe_lines (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  modifier_id     INTEGER NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id),
  quantity_change NUMERIC(14,3) NOT NULL CHECK (quantity_change <> 0)
);

-- ── Carichi di merce e bolle ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goods_receipts (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  received_on     DATE NOT NULL,
  document_number TEXT,
  notes           TEXT,
  total_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0),
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `quantity` è in confezioni, `base_quantity` in unità di base; costi in centesimi, senza IVA
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  goods_receipt_id   INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  ingredient_id      INTEGER NOT NULL REFERENCES ingredients(id),
  purchase_unit_name TEXT NOT NULL,
  quantity           NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  base_quantity      NUMERIC(14,3) NOT NULL CHECK (base_quantity > 0),
  unit_cost_cents    INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  vat_rate           NUMERIC(5,2) CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  line_cost_cents    INTEGER NOT NULL CHECK (line_cost_cents >= 0)
);

-- Foto o file della bolla (max 8 MB): nello stesso database, quindi stesso backup e stessa isolamento fra locali
CREATE TABLE IF NOT EXISTS stored_documents (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL DEFAULT 'delivery_note' CHECK (kind IN ('delivery_note')),
  file_name        TEXT NOT NULL,
  content_type     TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes       INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  data             BYTEA NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Controlli di magazzino (conteggio fisico della dispensa) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_levels (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  session_id   INTEGER REFERENCES sessions(id),
  kind         TEXT NOT NULL DEFAULT 'periodic' CHECK (kind IN ('closing', 'periodic')),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  notes        TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_level_lines (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  stock_level_id    INTEGER NOT NULL REFERENCES stock_levels(id) ON DELETE CASCADE,
  ingredient_id     INTEGER NOT NULL REFERENCES ingredients(id),
  expected_quantity NUMERIC(14,3) NOT NULL,
  counted_quantity  NUMERIC(14,3) NOT NULL CHECK (counted_quantity >= 0),
  difference        NUMERIC(14,3) GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  UNIQUE (stock_level_id, ingredient_id)
);

-- ── Il registro dei movimenti ───────────────────────────────────────────────────────────────────────────────────────────
-- Ogni variazione di un ingrediente, senza mai cancellare né correggere una riga (chi sbaglia scrive un movimento nuovo).
-- `quantity_change` positivo = entra, negativo = esce. I riferimenti (ordine, carico, controllo) sono semplici numeri,
-- così lo storico non si perde se l'oggetto viene eliminato.
CREATE TABLE IF NOT EXISTS ingredient_movements (
  id               BIGSERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  ingredient_id    INTEGER NOT NULL REFERENCES ingredients(id),
  kind             TEXT NOT NULL CHECK (kind IN ('receipt', 'sale', 'sale_reversal', 'usage', 'waste', 'adjustment', 'stock_level')),
  quantity_change  NUMERIC(14,3) NOT NULL,
  unit_cost        NUMERIC(14,4),
  reason           TEXT,
  order_id         INTEGER,
  goods_receipt_id INTEGER,
  stock_level_id   INTEGER,
  session_id       INTEGER,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredient_movements_ingredient ON ingredient_movements (ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingredient_movements_order ON ingredient_movements (order_id) WHERE order_id IS NOT NULL;

-- ── Isolamento fra locali: indice e RLS su ogni tabella nuova ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  tabella text;
BEGIN
  FOREACH tabella IN ARRAY ARRAY[
    'ingredients', 'suppliers', 'supplier_ingredients', 'preparations', 'recipe_lines', 'modifier_recipe_lines',
    'goods_receipts', 'goods_receipt_lines', 'stored_documents', 'stock_levels', 'stock_level_lines', 'ingredient_movements'
  ] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', 'idx_' || tabella || '_tenant', tabella);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabella);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabella);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tabella);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::int) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::int)',
      tabella
    );
  END LOOP;
END $$;

-- Il registro non si corregge e non si cancella dall'app (si scrive un movimento nuovo). Il master lo elimina insieme al locale.
REVOKE UPDATE, DELETE ON TABLE ingredient_movements FROM smarteats_app;
