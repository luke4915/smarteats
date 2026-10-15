-- Feedback sull'app: ogni utente può lasciare un suggerimento o segnalare un problema, per modulo. Lo legge il master.
CREATE TABLE IF NOT EXISTS app_feedback (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT NOT NULL,
  module     TEXT NOT NULL CHECK (module IN ('general', 'pos', 'floor', 'reservations', 'takeaway', 'kitchen', 'catalog', 'stats', 'settings')),
  message    TEXT NOT NULL CHECK (length(btrim(message)) BETWEEN 3 AND 2000),
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_feedback_tenant ON app_feedback (tenant_id, created_at DESC);
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_feedback FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON app_feedback;
CREATE POLICY tenant_isolation ON app_feedback
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);
-- il master legge il feedback di tutti i locali (come l'elenco degli utenti)
DROP POLICY IF EXISTS master_read ON app_feedback;
CREATE POLICY master_read ON app_feedback FOR SELECT TO standmanager_master USING (true);
