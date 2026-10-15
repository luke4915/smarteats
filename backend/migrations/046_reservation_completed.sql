-- Una prenotazione «al tavolo» che ha pagato e se n'è andata non resta «al tavolo»: diventa «conclusa» e libera il tavolo.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'seated', 'completed', 'no_show', 'expired'));

-- Ripulisce quelle già rimaste a metà: conto pagato = conclusa; conto annullato = torna «confermata» (era stato
-- aperto per sbaglio); conto unito a un altro = segue il conto di destinazione.
UPDATE reservations r SET check_id = c.merged_into
  FROM checks c WHERE r.check_id = c.id AND c.status = 'void' AND c.merged_into IS NOT NULL AND r.status = 'seated';
UPDATE reservations r SET status = 'completed'
  FROM checks c WHERE r.check_id = c.id AND c.status = 'paid' AND r.status = 'seated';
UPDATE reservations r SET status = 'confirmed', check_id = NULL
  FROM checks c WHERE r.check_id = c.id AND c.status = 'void' AND r.status = 'seated';
