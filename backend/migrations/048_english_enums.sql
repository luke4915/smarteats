-- Nomenclatura in inglese (CLAUDE.md, «Nomenclatura»): ruoli e tipi di locale salvati nel database.
--   ruoli:  responsabile → manager, cassa → cashier, cameriere → waiter, cucina → kitchen (admin resta)
--   locali: sagra e paninaro (la stessa cosa) → street_food, ristorante → restaurant
-- Le sessioni già aperte restano valide: `authenticate` legge il ruolo attuale dal database, non quello del token.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_business_type_check;

-- `users` ha la RLS forzata anche per il proprietario: per aggiornare tutti i locali in una volta la si sospende
-- per la durata di questa transazione.
ALTER TABLE users NO FORCE ROW LEVEL SECURITY;
UPDATE users SET role = CASE role
  WHEN 'responsabile' THEN 'manager'
  WHEN 'cassa' THEN 'cashier'
  WHEN 'cameriere' THEN 'waiter'
  WHEN 'cucina' THEN 'kitchen'
  ELSE role END
WHERE role IN ('responsabile', 'cassa', 'cameriere', 'cucina');
ALTER TABLE users FORCE ROW LEVEL SECURITY;

UPDATE tenants SET business_type = CASE business_type
  WHEN 'sagra' THEN 'street_food'
  WHEN 'paninaro' THEN 'street_food'
  WHEN 'ristorante' THEN 'restaurant'
  ELSE business_type END
WHERE business_type IN ('sagra', 'paninaro', 'ristorante');

ALTER TABLE tenants ALTER COLUMN business_type SET DEFAULT 'street_food';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen'));
ALTER TABLE tenants ADD CONSTRAINT tenants_business_type_check
  CHECK (business_type IN ('street_food', 'restaurant'));
