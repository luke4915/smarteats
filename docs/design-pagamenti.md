# Pagamento dell'asporto con carta (Stripe Connect)

Migrazione 058, `utils/takeawayPayments.js`, `utils/payments/`, `routes/stripeWebhook.js`. Costi e scelte in breve.

## Come funziona
1. Il locale ha un **conto Stripe collegato** (Connect, tipo Express): lo crea il master dal pannello (collegamento guidato o incolla `acct_…`).
   Il master accende anche il modulo `payments`. Il locale sceglie in Impostazioni → Asporto: **spento**, **facoltativo** o **obbligatorio**.
2. Il cliente, dal sito (`/order`), sceglie «Paga ora con carta» e va su una pagina di pagamento **di Stripe** (Checkout): la carta non passa mai
   da noi, niente PCI da gestire, Apple Pay e Google Pay inclusi.
3. Il pagamento è un'**autorizzazione** (`capture_method: manual`): la carta si impegna, i soldi non si muovono. La richiesta compare al locale solo quando
   Stripe conferma (webhook `checkout.session.completed`).
4. Il locale **accetta** → si incassa (capture). **Rifiuta**, il cliente **ritira la richiesta** o la richiesta **scade** → l'autorizzazione si rilascia:
   nessun addebito, nessun rimborso. Un ordine già incassato e poi annullato dal locale si **rimborsa**.
5. Alla consegna non si chiede nulla: l'ordine è carta (`paid_method = 'card'`) e non entra nei contanti attesi del cassetto.

## Stati (`takeaway_orders.payment_status`)
`none` (si paga al ritiro) · `awaiting` (il cliente è alla pagina di pagamento: invisibile al locale, scade dopo 30 minuti) · `authorized` · `paid` · `canceled` · `refunded`.

## Costi
- Prove: gratis. Con una chiave `sk_test_…` e le carte di prova di Stripe non si muove un euro; in sviluppo e nei test c'è il driver `mock`.
- Reale: Stripe trattiene la sua commissione sulle carte europee (circa 1,5% + una quota fissa, da verificare sul sito di Stripe). Con i *destination charges*
  la paga la piattaforma e la **nostra commissione** (`STRIPE_FEE_PERCENT`, `application_fee_amount`) la copre e ci dà il margine. Un'autorizzazione rilasciata non costa.

## Sicurezza
- Chiavi solo in variabili d'ambiente (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). Il webhook accetta solo avvisi con la firma giusta sul corpo grezzo.
- L'importo lo calcola sempre il server dal catalogo. Il locale si ricava dai `metadata` che scriviamo noi e dalla pagina di pagamento che conosciamo (`stripe_session_id`): un avviso su una pagina estranea non cambia nulla.
- Le risposte pubbliche non contengono mai identificativi di Stripe.

## Da fare
- Pagamento «alla consegna con carta» tramite link (oggi si sceglie il metodo al banco). Partenza della cucina diversa per chi ha già pagato (vedi `docs/backlog.md`).
- Registratore telematico / scontrino fiscale: un pagamento online non lo sostituisce.
