-- PIN personale per utente: sblocca lo schermo bloccato e permette il cambio utente veloce sulla stessa cassa (solo personale operativo).
-- Il PIN è un segreto debole (4-6 cifre): per questo vale solo su un dispositivo già collegato al locale con un accesso completo (mai per il
-- primo accesso), si salva come hash e, dopo 5 errori, si blocca per 5 minuti (la password resta sempre valida).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_failed integer NOT NULL DEFAULT 0 CHECK (pin_failed >= 0),
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;
