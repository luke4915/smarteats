-- Portale pubblico di prenotazione (P2): quando il cliente ha accettato l'informativa, e un indice per contare le
-- richieste in attesa dello stesso numero di telefono.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS personal_data_purged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_pending_phone
  ON reservations (tenant_id, (right(regexp_replace(phone, '\D', '', 'g'), 10)))
  WHERE status = 'requested';
