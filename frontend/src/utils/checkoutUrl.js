// L'indirizzo della pagina di pagamento. Quella vera è di Stripe; il driver finto (sviluppo e demo) dà un indirizzo `checkout.mock` che non
// esiste su internet: lo portiamo alla nostra pagina di prova (`/mock-checkout/…`, pages/MockCheckoutPage.jsx), con gli stessi parametri.
export function checkoutTarget(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'checkout.mock') return url;
    return `/mock-checkout/${u.pathname.split('/').pop()}${u.search}`;
  } catch { return url; }
}
