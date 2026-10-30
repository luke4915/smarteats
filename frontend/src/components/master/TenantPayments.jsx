import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { btn, btnPrimary, input, label } from '../../smarteats/floor/ui';
import { apiFetch } from '../../utils/apiClient';
import Loading from '../shared/Loading';

// Scheda «Pagamenti» della finestra di un locale (solo se ha il modulo): il conto Stripe collegato su cui arrivano i pagamenti con carta
// dell'asporto. Si incolla un conto già creato (acct_…) oppure si genera il collegamento guidato da mandare al titolare, che inserisce i suoi
// dati direttamente su Stripe. Le chiavi della piattaforma stanno sul server (STRIPE_SECRET_KEY), mai qui.
const DRIVER_NOTE = {
  off: ['Pagamenti spenti su questo server: manca STRIPE_SECRET_KEY. Finché non c\'è, i clienti pagano al ritiro.', 'text-amber-500'],
  mock: ['Server in modalità di prova: nessun pagamento reale.', 'text-[var(--text-muted)]'],
  stripe: ['Stripe collegato.', 'text-emerald-500'],
};

const TenantPayments = ({ tenant }) => {
  const [data, setData] = useState(null);
  const [account, setAccount] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const apply = (d) => { setData(d); setAccount(d.stripe_account_id ?? ''); };
  useEffect(() => { apiFetch(`/master/tenants/${tenant.id}/payments`).then(apply).catch(err => setError(err.message)); }, [tenant.id]);

  const run = async (fn) => {
    setBusy(true); setError(''); setNote('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const save = (value) => run(async () => { apply(await apiFetch(`/master/tenants/${tenant.id}/payments`, { method: 'PUT', body: { stripe_account_id: value || null } })); setNote(value ? 'Conto collegato' : 'Conto scollegato'); });
  const onboard = () => run(async () => {
    const r = await apiFetch(`/master/tenants/${tenant.id}/payments/onboard`, { method: 'POST', body: {} });
    setLink(r.url); apply(await apiFetch(`/master/tenants/${tenant.id}/payments`));
  });

  if (!data && !error) return <Loading />;
  const [driverText, driverTone] = DRIVER_NOTE[data?.driver ?? 'off'];
  const status = data?.account;
  return (
    <div className="space-y-5 max-w-2xl">
      {data && <p className={`text-sm ${driverTone}`}>{driverText}{data.fee_percent > 0 && ` Commissione sui pagamenti: ${data.fee_percent}%.`}</p>}
      {data && !data.module_enabled && <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-500">Il modulo è spento per questo locale: accendilo da «Moduli» perché i clienti possano pagare.</p>}

      <div>
        <label className={label} htmlFor="tenant-stripe">Conto Stripe collegato</label>
        <div className="flex gap-2 mt-1">
          <input id="tenant-stripe" className={`${input} flex-1`} placeholder="acct_…" value={account} onChange={e => { setAccount(e.target.value.trim()); setNote(''); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <button className={btnPrimary} disabled={busy || account === (data?.stripe_account_id ?? '')} onClick={() => save(account)}>Salva</button>
        </div>
        {data?.stripe_account_id && (
          <p className="text-sm mt-2">
            {status?.error ? <span className="text-red-500">Stripe non risponde per questo conto.</span>
              : status?.chargesEnabled ? <span className="text-emerald-500">Attivo: può ricevere pagamenti.</span>
                : status ? <span className="text-amber-500">Da completare: il titolare deve ancora inserire i suoi dati su Stripe.</span> : null}
            {' '}<button className="text-[var(--text-muted)] underline cursor-pointer" disabled={busy} onClick={() => save('')}>Scollega</button>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-[var(--text-muted)]">Non hai ancora un conto per questo locale? Genera il collegamento guidato e mandalo al titolare: i suoi dati li inserisce direttamente su Stripe.</p>
        <button className={btn} disabled={busy || data?.driver === 'off'} onClick={onboard}><Link2 size={15} /> Genera il collegamento</button>
        {link && (
          <div className="flex items-center gap-2">
            <input readOnly className={`${input} flex-1`} value={link} aria-label="Collegamento guidato" onFocus={e => e.target.select()} />
            <button className={btn} onClick={() => navigator.clipboard?.writeText(link)}><Copy size={15} /> Copia</button>
            <a className={btn} href={link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Apri</a>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {note && <p className="text-sm text-emerald-500">{note}</p>}
    </div>
  );
};

export default TenantPayments;
