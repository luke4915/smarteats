import { useState, useEffect } from 'react';
import { Save, Send } from 'lucide-react';
import { btn, btnPrimary, input } from '../../smarteats/floor/ui';
import { apiFetch } from '../../utils/apiClient';

// Scheda «WhatsApp» della finestra di un locale: quali eventi mandano un messaggio, tetto mensile di pratiche, registro degli ultimi
// invii e un messaggio di prova. Il modulo si accende da «Moduli». Il locale non configura nulla: solo qui.
const REF = { reservation: 'Prenotazioni', takeaway: 'Asporto' };
const STATUS = {
  queued: ['In coda', 'text-amber-500'], sent: ['Inviato', 'text-emerald-500'], delivered: ['Consegnato', 'text-emerald-500'],
  read: ['Letto', 'text-emerald-500'], failed: ['Fallito', 'text-red-500'], skipped: ['Non inviato', 'text-[var(--text-muted)]'],
};
const REASON = {
  NUMERO_NON_VALIDO: 'numero non valido', TETTO_MENSILE: 'tetto mensile raggiunto', GIA_GESTITA: 'già gestita', STATO_CAMBIATO: 'stato cambiato',
  EVENTO_SPENTO: 'evento spento', DISISCRITTO: 'ha scritto STOP', SENZA_CONSENSO: 'senza consenso', TURNO_PASSATO: 'turno passato', TROPPI_AVVISI: 'troppi avvisi', PRATICA_NON_TROVATA: 'pratica non trovata',
};

const TenantWhatsApp = ({ tenant }) => {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState({});
  const [quota, setQuota] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const d = await apiFetch(`/master/tenants/${tenant.id}/whatsapp`);
      setData(d); setQuota(String(d.quota)); setEvents(Object.fromEntries(d.events.map(e => [e.id, e.enabled])));
    } catch (err) { setError(err.message); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      await apiFetch(`/master/tenants/${tenant.id}/whatsapp`, { method: 'PUT', body: { events, quota: Number(quota) } });
      setNote('Salvato'); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setError(''); setNote('');
    try { const r = await apiFetch(`/master/tenants/${tenant.id}/whatsapp/test`, { method: 'POST', body: { to } }); setNote(`Prova inviata (${r.driver}): «${r.preview}»`); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
        {!data && !error && <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
        {data && (
          <div className="space-y-6">
            {!data.module_enabled && <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-500">Il modulo è spento per questo locale: accendilo da «Moduli» perché gli avvisi partano.</p>}
            {data.driver === 'off' && <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-500">Gli avvisi sono disattivati su questo server (variabile <code>WHATSAPP_DRIVER</code>).</p>}
            {data.driver === 'mock' && <p className="text-xs text-[var(--text-muted)]">Server in modalità di prova: i messaggi non escono davvero.</p>}

            <section>
              <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">Eventi</h3>
              {Object.entries(REF).map(([ref, title]) => (
                <div key={ref} className="mb-3">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">{title}</p>
                  <ul className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
                    {data.events.filter(e => e.ref === ref).map(e => (
                      <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                        <input id={e.id} type="checkbox" className="mt-1 w-4 h-4 accent-[var(--accent)] cursor-pointer" checked={!!events[e.id]} onChange={ev => setEvents(x => ({ ...x, [e.id]: ev.target.checked }))} />
                        <label htmlFor={e.id} className="min-w-0 flex-1 cursor-pointer">
                          <span className="block text-sm font-medium text-[var(--text-main)]">{e.label}{e.category === 'marketing' && <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">marketing · solo con consenso</span>}</span>
                          <span className="block text-xs text-[var(--text-muted)]">{e.body.replace(/\{\{(\d+)\}\}/g, '…')}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-3">
                <label className="block"><span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Pratiche incluse al mese</span>
                  <input className={`${input} !w-32`} type="number" min="0" value={quota} onChange={e => setQuota(e.target.value)} /></label>
                <p className="text-sm text-[var(--text-muted)] pb-2">Questo mese: <b className="text-[var(--text-main)] tabular-nums">{data.used}</b> pratiche con avvisi</p>
                <button className={`${btnPrimary} ml-auto`} disabled={busy} onClick={save}><Save size={15} /> Salva</button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">Messaggio di prova</h3>
              <div className="flex gap-2">
                <input className={`${input} flex-1`} placeholder="Cellulare, es. 333 1234567" value={to} onChange={e => setTo(e.target.value)} />
                <button className={btn} disabled={busy || !to.trim()} onClick={test}><Send size={15} /> Invia prova</button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">Ultimi invii</h3>
              {data.log.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nessun avviso ancora.</p> : (
                <ul className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
                  {data.log.map(m => {
                    const [label, tone] = STATUS[m.status] ?? [m.status, ''];
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="text-xs text-[var(--text-muted)] tabular-nums w-28 shrink-0">{new Date(m.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="flex-1 min-w-0 truncate text-[var(--text-main)]">{REF[m.ref_type]} · {m.event}{m.to_tail ? ` · …${m.to_tail}` : ''}</span>
                        <span className={`text-xs font-medium ${tone}`}>{label}{m.error ? ` · ${REASON[m.error] ?? m.error}` : ''}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
        {note && <p className="text-sm text-emerald-500 mt-4">{note}</p>}
        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
    </div>
  );
};

export default TenantWhatsApp;
