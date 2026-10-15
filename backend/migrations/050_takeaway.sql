-- Modulo asporto (takeaway): ordini con orario di ritiro a fasce, approvati dal locale, dal sito pubblico, dal telefono
-- o dal banco. Prima dell'approvazione l'ordine vive solo qui (con le righe in `items`); all'approvazione nasce
-- l'ordine di cucina (`orders`) sulla sessione aperta e la cucina lo vede con orario e nome.

-- «Carico» di un prodotto sul forno: quante unità di capacità occupa una porzione (una pizza = 1; una bibita = 0).
ALTER TABLE products ADD COLUMN IF NOT EXISTS takeaway_load integer NOT NULL DEFAULT 1;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_takeaway_load_check;
ALTER TABLE products ADD CONSTRAINT products_takeaway_load_check CHECK (takeaway_load BETWEEN 0 AND 20);

-- Orari in cui si accettano ordini da asporto: una o più finestre per giorno della settimana (0 = domenica)
CREATE TABLE IF NOT EXISTS takeaway_hours (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time  TIME NOT NULL,
  close_time TIME NOT NULL,
  CHECK (close_time > open_time)
);
CREATE INDEX IF NOT EXISTS idx_takeaway_hours_tenant ON takeaway_hours (tenant_id, weekday);
ALTER TABLE takeaway_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeaway_hours FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON takeaway_hours;
CREATE POLICY tenant_isolation ON takeaway_hours
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

CREATE TABLE IF NOT EXISTS takeaway_orders (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  -- requested → accepted → picked_up; oppure rejected (dal locale) o cancelled (dal cliente o dal locale)
  status         TEXT NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested', 'accepted', 'picked_up', 'rejected', 'cancelled')),
  source         TEXT NOT NULL CHECK (source IN ('portal', 'counter', 'phone')),
  pickup_at      TIMESTAMPTZ NOT NULL,
  -- carico sul forno (somma di quantità × takeaway_load): conta per la capienza della fascia finché l'ordine è vivo
  load           INTEGER NOT NULL DEFAULT 0 CHECK (load >= 0),
  customer_name  TEXT NOT NULL CHECK (length(btrim(customer_name)) > 0),
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  items          JSONB NOT NULL,
  total          NUMERIC(10,2) NOT NULL,
  order_id       INTEGER REFERENCES orders(id),
  public_token   TEXT NOT NULL,
  -- predisposizione al pagamento online: oggi si paga sempre al ritiro
  payment_mode   TEXT NOT NULL DEFAULT 'on_pickup' CHECK (payment_mode IN ('on_pickup', 'online')),
  paid_method    TEXT CHECK (paid_method IN ('cash', 'card', 'other')),
  reject_reason  TEXT NOT NULL DEFAULT '',
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  picked_up_at   TIMESTAMPTZ,
  consent_at     TIMESTAMPTZ,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  personal_data_purged_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_takeaway_orders_token ON takeaway_orders (public_token);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_takeaway_orders_order ON takeaway_orders (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_takeaway_orders_pickup ON takeaway_orders (tenant_id, pickup_at);
CREATE INDEX IF NOT EXISTS idx_takeaway_orders_pending_phone
  ON takeaway_orders (tenant_id, (right(regexp_replace(phone, '\D', '', 'g'), 10))) WHERE status = 'requested';
ALTER TABLE takeaway_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeaway_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON takeaway_orders;
CREATE POLICY tenant_isolation ON takeaway_orders
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);
