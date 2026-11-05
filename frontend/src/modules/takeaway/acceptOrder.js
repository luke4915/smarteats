// Accetta un ordine da asporto. Se un ingrediente non basta il server risponde 409 INGREDIENT_SHORTAGE: admin e responsabile possono
// scegliere «Vendi comunque» (`askForce`, vedi hooks/useForceSale.js) e la richiesta si ripete con `force_stock`; per gli altri resta il rifiuto.
import { fetchWithAuth } from '../../utils/apiClient';
import { SHORTAGE_CODE } from '../../hooks/useForceSale';
import { autoPrintOn } from '../../print/autoPrint';
import { printOrderTickets } from '../../print/printOrder';

// Se questo dispositivo stampa da sé la comanda dell'asporto (print/autoPrint.js) e l'ordine va in cucina oggi, la mette in coda di stampa.
// Un errore di stampa non annulla l'accettazione: l'ordine è già in cucina.
async function printKitchenTicket(order) {
  if (!order.kitchen_ticket || !autoPrintOn('takeaway')) return;
  try {
    await printOrderTickets({
      cart: order.kitchen_ticket.items.map(i => ({ ...i, type: 'sale', discountMode: null, discountValue: null })),
      displayCode: order.display_code, clientOrderId: `takeaway-${order.id}`, sessionId: null, isTakeaway: true,
    });
  } catch { /* si ristampa dall'ordine in cucina */ }
}

export async function acceptOrder(id, body, askForce) {
  const send = (extra) => fetchWithAuth(`/takeaway/orders/${id}/accept`, { method: 'POST', body: { ...body, ...extra } });
  let order;
  try { order = await send({}); }
  catch (err) {
    if (!(err?.code === SHORTAGE_CODE && await askForce(err.message))) throw err;
    order = await send({ force_stock: true });
  }
  await printKitchenTicket(order);
  return order;
}
