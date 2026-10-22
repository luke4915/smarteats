-- I tavoli hanno un intervallo di occupazione: `seats_min` (da quante persone conviene usarlo) e `seats` (il massimo, come prima).
-- Il minimo è un consiglio, non un divieto: un gruppo più piccolo si può sedere, ma la scelta del tavolo lo evita se c'è di meglio.
-- Per i tavoli esistenti il minimo parte uguale al massimo, così nulla cambia finché l'admin non lo modifica.
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS seats_min INTEGER NOT NULL DEFAULT 1;
UPDATE dining_tables SET seats_min = seats WHERE seats_min = 1 AND seats > 1;
ALTER TABLE dining_tables DROP CONSTRAINT IF EXISTS dining_tables_seats_min_check;
ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_seats_min_check CHECK (seats_min >= 1 AND seats_min <= seats);
