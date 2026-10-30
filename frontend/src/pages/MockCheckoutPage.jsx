import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { PublicShell } from '../components/public/PublicShell';
import { apiFetch } from '../utils/apiClient';
import { formatCents } from '../utils/format';
import { btn, btnPrimary } from '../smarteats/floor/ui';
import { useSystemTheme } from '../hooks/useSystemTheme';

// La pagina di pagamento di PROVA (sviluppo e demo, con il driver finto): al posto di quella di Stripe. Nessuna carta e nessun addebito.
// «Pagamento riuscito» manda al server lo stesso avviso firmato che manderebbe Stripe (`/api/webhooks/stripe`, firma `mock-valid`) e
// riporta alla pagina dell'ordine; con il driver vero questa pagina non fa nulla (il server rifiuta l'avviso).
const MockCheckoutPage = () => {
  useSystemTheme();
  const sessionId = window.location.pathname.split('/').filter(Boolean)[1] ?? '';
  const q = new URLSearchParams(window.location.search);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const paid = async () => {
    setBusy(true); setError('');
    try {
      await apiFetch('/webhooks/stripe', {
        method: 'POST', headers: { 'stripe-signature': 'mock-valid' },
        body: { id: `evt_${sessionId}`, type: 'checkout.session.completed', data: { object: { id: sessionId, payment_intent: `pi_${sessionId}`, metadata: { tenant_id: q.get('tenant'), takeaway_id: q.get('order') } } } },
      });
      window.location.assign(q.get('return') || '/');
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <PublicShell kicker="Pagamento di prova">
      <div className="rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex items-center gap-3"><CreditCard className="text-[var(--accent)]" /><h1 className="text-xl font-semibold">Pagamento di prova</h1></div>
        <p className="text-sm text-[var(--text-muted)]">Questa pagina prende il posto di quella di Stripe nelle prove: nessuna carta, nessun addebito.</p>
        {q.get('amount') && <p className="text-3xl font-semibold tabular-nums">{formatCents(Number(q.get('amount')))}</p>}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className={`${btnPrimary} !h-12 flex-1`} disabled={busy} onClick={paid}>{busy ? 'Un attimo…' : 'Pagamento riuscito'}</button>
          <button type="button" className={`${btn} !h-12 flex-1`} disabled={busy} onClick={() => window.location.assign(q.get('cancel') || '/')}>Annulla</button>
        </div>
      </div>
    </PublicShell>
  );
};

export default MockCheckoutPage;
