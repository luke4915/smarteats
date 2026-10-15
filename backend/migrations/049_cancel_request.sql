-- Annullo chiesto dal cliente su una prenotazione già confermata: il locale lo conferma o lo rifiuta.
-- Nullo = nessuna richiesta di annullo in corso.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_reservations_cancel_requested ON reservations (tenant_id, date) WHERE cancel_requested_at IS NOT NULL;
