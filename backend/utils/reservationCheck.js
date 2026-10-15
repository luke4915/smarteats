// Il conto di un tavolo e la prenotazione «al tavolo» che l'ha aperto vanno d'accordo: quando il conto si chiude, la
// prenotazione non può restare «al tavolo» a occupare la pianta e l'agenda.
//   pagato   → la prenotazione è conclusa (i clienti se ne sono andati);
//   annullato → il conto era aperto per sbaglio: la prenotazione torna confermata, col suo tavolo;
//   unito     → la prenotazione segue il conto di destinazione.
// Va chiamata nella stessa transazione che chiude il conto. Ritorna true se una prenotazione è cambiata.
const DONE = 'completed';   // stato finale di una prenotazione servita

export async function settleReservationForCheck(db, checkId, outcome, { mergedInto } = {}) {
  let result;
  if (outcome === 'paid') {
    result = await db.query(`UPDATE reservations SET status = $2 WHERE check_id = $1 AND status = 'seated'`, [checkId, DONE]);
  } else if (outcome === 'merged') {
    result = await db.query(`UPDATE reservations SET check_id = $2 WHERE check_id = $1 AND status = 'seated'`, [checkId, mergedInto]);
  } else {
    result = await db.query(`UPDATE reservations SET status = 'confirmed', check_id = NULL WHERE check_id = $1 AND status = 'seated'`, [checkId]);
  }
  return result.rowCount > 0;
}
