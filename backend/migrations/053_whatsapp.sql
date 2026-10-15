-- Avvisi WhatsApp (docs/design-whatsapp.md): coda di invio («outbox») con un messaggio per evento e pratica.
-- Una pratica è una prenotazione o un ordine da asporto; la riga unica (pratica, evento) impedisce doppi invii.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::int REFERENCES tenants(id),
  ref_type        TEXT NOT NULL CHECK (ref_type IN ('reservation', 'takeaway')),
  ref_id          INTEGER NOT NULL,
  event           TEXT NOT NULL,
  to_phone        TEXT NOT NULL DEFAULT '',
  template        TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'utility' CHECK (category IN ('utility', 'marketing')),
  params          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  error           TEXT NOT NULL DEFAULT '',
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  wa_message_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_case_event ON whatsapp_messages (tenant_id, ref_type, ref_id, event);
CREATE INDEX IF NOT EXISTS idx_whatsapp_due ON whatsapp_messages (tenant_id, next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_whatsapp_ref ON whatsapp_messages (tenant_id, ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_wa_id ON whatsapp_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON whatsapp_messages;
CREATE POLICY tenant_isolation ON whatsapp_messages
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);
-- il master legge il registro di tutti i locali (assistenza)
DROP POLICY IF EXISTS master_read ON whatsapp_messages;
CREATE POLICY master_read ON whatsapp_messages FOR SELECT TO standmanager_master USING (true);

-- Una richiesta di asporto non gestita scade poco prima del ritiro
ALTER TABLE takeaway_orders DROP CONSTRAINT IF EXISTS takeaway_orders_status_check;
ALTER TABLE takeaway_orders ADD CONSTRAINT takeaway_orders_status_check
  CHECK (status IN ('requested', 'accepted', 'picked_up', 'rejected', 'cancelled', 'expired'));
