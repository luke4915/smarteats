import { Users, Clock, Power, Trash2, Printer, ExternalLink } from 'lucide-react';
import { btn, btnDanger, label } from '../../smarteats/floor/ui';
import { licenseStatus, addressOf } from './licenseStatus';

// Scheda «Generale» della finestra di un locale: i dati in breve, la licenza, gli scontrini e l'eliminazione. Le azioni
// arrivano già pronte in `on`: extend(days), toggle, receipt, remove.
const Fact = ({ name, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--border)] last:border-0">
    <dt className="text-sm text-[var(--text-muted)] shrink-0">{name}</dt>
    <dd className="text-sm text-[var(--text-main)] text-right min-w-0">{children}</dd>
  </div>
);

const Group = ({ title, hint, children }) => (
  <section>
    <h3 className={label}>{title}</h3>
    {hint && <p className="text-sm text-[var(--text-muted)] mt-0.5">{hint}</p>}
    <div className="mt-2 flex flex-wrap gap-2">{children}</div>
  </section>
);

const TenantGeneral = ({ tenant: t, catalog, on }) => {
  const status = licenseStatus(t);
  const type = catalog?.businessTypes.find(b => b.id === t.business_type)?.label ?? t.business_type;
  const users = Number(t.user_count);
  return (
    <div className="space-y-6">
      <dl className="rounded-lg border border-[var(--border)] px-4">
        <Fact name="Indirizzo">
          {catalog
            ? <a href={addressOf(t.slug, catalog.appDomain)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--accent)]">{t.slug}<ExternalLink size={13} /></a>
            : t.slug}
        </Fact>
        <Fact name="Prodotto">{type}</Fact>
        <Fact name="Licenza"><span className="inline-flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${status.dot}`} />{status.label}</span></Fact>
        <Fact name="Piano">{t.plan}</Fact>
        <Fact name="Utenti"><span className="inline-flex items-center gap-1.5"><Users size={14} />{users} {users === 1 ? 'utente' : 'utenti'}</span></Fact>
      </dl>

      <Group title="Licenza" hint="Allunga la scadenza, oppure sospendi l'accesso del locale.">
        <button onClick={() => on.extend(7)} className={btn}><Clock size={16} /> +7 giorni</button>
        <button onClick={() => on.extend(30)} className={btn}><Clock size={16} /> +30 giorni</button>
        <button onClick={on.toggle} className={btn}><Power size={16} /> {t.active ? 'Disattiva' : 'Riattiva'}</button>
      </Group>

      <Group title="Scontrini" hint="Testi, logo e intestazione stampati sulle ricevute del locale.">
        <button onClick={on.receipt} className={btn}><Printer size={16} /> Apri l&apos;editor</button>
      </Group>

      <Group title="Eliminazione" hint="Cancella il locale con prodotti, ordini e utenti. Non si può annullare.">
        <button onClick={on.remove} className={btnDanger}><Trash2 size={16} /> Elimina il locale</button>
      </Group>
    </div>
  );
};

export default TenantGeneral;
