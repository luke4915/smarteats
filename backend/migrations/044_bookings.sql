-- ============================================
-- Prenotazioni (Fase 4, passo P1)
-- ============================================
-- Turni fissi, chiusure, prenotazioni e tavoli assegnati. Disegno in docs/design-prenotazioni.md.
-- `reservations.date` è la data nel locale (senza fuso): la sceglie chi prenota. L'ora viene dal turno
-- (`booking_shifts.start_time`) e la durata del tavolo da `duration_minutes`.
CREATE TABLE IF NOT EXISTS booking_shifts (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  name             TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  start_time       TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes BETWEEN 15 AND 480),
  weekdays         SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  capacity         INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 999),
  active           BOOLEAN NOT NULL DEFAULT true,
  position         INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_shifts_tenant_name ON booking_shifts (tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_booking_shifts_tenant ON booking_shifts (tenant_id);

-- Giorni (o un turno di certi giorni) in cui non si prenota: ferie, evento privato.
CREATE TABLE IF NOT EXISTS booking_closures (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  date_from  DATE NOT NULL,
  date_to    DATE NOT NULL,
  shift_id   INTEGER REFERENCES booking_shifts(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL DEFAULT '',
  CONSTRAINT booking_closures_range CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS idx_booking_closures_tenant ON booking_closures (tenant_id, date_from);

CREATE TABLE IF NOT EXISTS reservations (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  date           DATE NOT NULL,
  shift_id       INTEGER NOT NULL REFERENCES booking_shifts(id),
  party_size     INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 99),
  status         TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'seated', 'no_show', 'expired')),
  customer_name  TEXT NOT NULL CHECK (length(btrim(customer_name)) > 0),
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  source         TEXT NOT NULL DEFAULT 'staff',
  external_id    TEXT,
  public_token   TEXT NOT NULL,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decline_reason TEXT NOT NULL DEFAULT '',
  check_id       INTEGER REFERENCES checks(id) ON DELETE SET NULL,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservations_token ON reservations (public_token);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservations_external ON reservations (tenant_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date ON reservations (tenant_id, date, shift_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check ON reservations (check_id) WHERE check_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reservation_tables (
  tenant_id       INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  reservation_id  INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  table_id        INTEGER NOT NULL REFERENCES dining_tables(id),
  PRIMARY KEY (reservation_id, table_id)
);
CREATE INDEX IF NOT EXISTS idx_reservation_tables_tenant ON reservation_tables (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_tables_table ON reservation_tables (table_id);

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['booking_shifts', 'booking_closures', 'reservations', 'reservation_tables'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::int)', tbl);
  END LOOP;
END $$;
