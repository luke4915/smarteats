-- Pagamento dell'asporto con carta (Stripe Connect, disegno in docs/design-pagamenti.md): il conto Stripe collegato di ogni locale e lo
-- stato del pagamento di ogni ordine.
--
-- Il cliente paga al momento della richiesta con una *autorizzazione* (la carta si impegna, i soldi non si muovono): il locale accetta e
-- l'importo si incassa, rifiuta o la richiesta scade e l'autorizzazione si rilascia (nessun addebito, nessun rimborso da gestire).

-- Il conto Stripe collegato del locale (acct_…): lo scrive solo il master
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id text CHECK (stripe_account_id IS NULL OR stripe_account_id ~ '^acct_[A-Za-z0-9]+$');

-- awaiting = il cliente è alla pagina di pagamento; authorized = carta impegnata; paid = incassato (all'accettazione);
-- canceled = rilasciato senza addebito; refunded = incassato e poi restituito; none = si paga al ritiro
ALTER TABLE takeaway_orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'none' CHECK (payment_status IN ('none', 'awaiting', 'authorized', 'paid', 'canceled', 'refunded')),
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_takeaway_orders_stripe_session ON takeaway_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_takeaway_orders_awaiting ON takeaway_orders (tenant_id, requested_at) WHERE payment_status = 'awaiting';
