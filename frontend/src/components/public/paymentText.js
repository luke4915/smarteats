import { textIn } from '../../i18n/useLanguage.js';

const italian = (key, params) => textIn('it', key, params);
// Cosa si dice al cliente sul pagamento del suo ordine da asporto (pagina `/order/<codice>`). Pura (provata in paymentText.test.js).
// `payment` = { online, status } dal server; `orderStatus` = lo stato dell'ordine. Il cliente non vede mai importi diversi dal totale.

// Una frase per ogni passo del pagamento online; `null` se si paga al ritiro.
export function paymentNote(payment, orderStatus, t = italian) {
  if (!payment?.online) return null;
  const closed = ['rejected', 'cancelled', 'expired'].includes(orderStatus);
  switch (payment.status) {
    case 'awaiting': return { tone: 'waiting', title: t('pay.awaiting.title'), body: t('pay.awaiting.body'), canPay: true };
    case 'authorized': return { tone: 'waiting', title: t('pay.authorized.title'), body: t('pay.authorized.body') };
    case 'paid': return { tone: 'good', title: t('pay.paid.title'), body: orderStatus === 'picked_up' ? t('pay.paid.bodyDone') : t('pay.paid.body') };
    case 'canceled': return { tone: 'bad', title: t('pay.canceled.title'), body: t('pay.canceled.body') };
    case 'refunded': return { tone: 'bad', title: t('pay.refunded.title'), body: t('pay.refunded.body') };
    default: return closed ? null : { tone: 'waiting', title: t('pay.default.title'), body: '' };
  }
}

// Il testo accanto al totale dell'ordine.
export function totalLabel(payment, orderStatus, t = italian) {
  if (!payment?.online) return t('pay.total.pickup');
  if (payment.status === 'paid') return t('pay.total.paid');
  if (['canceled', 'refunded'].includes(payment.status) || ['rejected', 'cancelled', 'expired'].includes(orderStatus)) return t('pay.total.plain');
  return t('pay.total.card');
}

// Le scelte di pagamento che il sito offre: ['online'] se è obbligatorio, ['online', 'on_pickup'] se facoltativo, ['on_pickup'] altrimenti.
export function paymentChoices(mode) {
  if (mode === 'required') return ['online'];
  if (mode === 'optional') return ['online', 'on_pickup'];
  return ['on_pickup'];
}
