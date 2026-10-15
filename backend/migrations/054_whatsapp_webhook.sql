-- Avvisi WhatsApp, fase W2: stato di consegna, STOP e fidelizzazione.
-- Il numero è unico per tutti i locali: quando Meta chiama il webhook (stato di un messaggio o risposta di un cliente)
-- non sappiamo a quale locale appartiene finché non lo risaliamo dall'id del messaggio o dal numero. Per questo due
-- tabelle *globali* (senza RLS, come `tenants`) che contengono solo il minimo: id messaggio, locale, numero e data.
CREATE TABLE IF NOT EXISTS whatsapp_message_tenants (
  wa_message_id TEXT PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_phone      TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_tenants_phone ON whatsapp_message_tenants (to_phone, sent_at DESC);

-- Chi ha scritto STOP: da questo numero non si scrive più, per nessun locale, finché non scrive RIPRENDI
CREATE TABLE IF NOT EXISTS whatsapp_optouts (
  phone      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consenso separato per i messaggi di fidelizzazione (marketing), dato con una casella dedicata sul sito
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;
