// Cosa si dice al cliente sul pagamento del suo ordine da asporto (pagina `/order/<codice>`). Pura (provata in paymentText.test.js).
// `payment` = { online, status } dal server; `orderStatus` = lo stato dell'ordine. Il cliente non vede mai importi diversi dal totale.

// Una frase per ogni passo del pagamento online; `null` se si paga al ritiro.
export function paymentNote(payment, orderStatus) {
  if (!payment?.online) return null;
  const closed = ['rejected', 'cancelled', 'expired'].includes(orderStatus);
  switch (payment.status) {
    case 'awaiting': return { tone: 'waiting', title: 'Manca il pagamento', body: 'Finisci di pagare con la carta: finché non è fatto il locale non vede la tua richiesta.', canPay: true };
    case 'authorized': return { tone: 'waiting', title: 'Carta autorizzata', body: 'Addebitiamo la carta solo se il locale accetta l\'ordine; se non può, non paghi nulla.' };
    case 'paid': return { tone: 'good', title: 'Pagato con carta', body: orderStatus === 'picked_up' ? 'Grazie!' : 'Al ritiro non devi pagare niente: dici solo il tuo codice.' };
    case 'canceled': return { tone: 'bad', title: 'Nessun addebito', body: 'La carta è stata liberata: non hai pagato nulla.' };
    case 'refunded': return { tone: 'bad', title: 'Importo restituito', body: 'Ti abbiamo restituito quanto pagato: arriva sulla carta in pochi giorni.' };
    default: return closed ? null : { tone: 'waiting', title: 'Pagamento online', body: '' };
  }
}

// Il testo accanto al totale dell'ordine.
export function totalLabel(payment, orderStatus) {
  if (!payment?.online) return 'Totale da pagare al ritiro';
  if (payment.status === 'paid') return 'Totale pagato';
  if (['canceled', 'refunded'].includes(payment.status) || ['rejected', 'cancelled', 'expired'].includes(orderStatus)) return 'Totale';
  return 'Totale (carta)';
}

// Le scelte di pagamento che il sito offre: ['online'] se è obbligatorio, ['online', 'on_pickup'] se facoltativo, ['on_pickup'] altrimenti.
export function paymentChoices(mode) {
  if (mode === 'required') return ['online'];
  if (mode === 'optional') return ['online', 'on_pickup'];
  return ['on_pickup'];
}
