-- Quante cifre ha il PIN di un utente, così la schermata di blocco mostra i puntini giusti (4, 5 o 6) e sblocca da sola all'ultima cifra.
-- È una lunghezza, non il PIN: il PIN resta solo come hash. I PIN già impostati prima di questa migrazione hanno `NULL` (lunghezza ignota)
-- e si mostrano come prima; basta rimpostarli per avere la lunghezza.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_length smallint CHECK (pin_length BETWEEN 4 AND 6);
