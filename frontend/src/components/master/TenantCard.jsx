import { Users, ExternalLink } from 'lucide-react';
import { btn } from '../../smarteats/floor/ui';
import { licenseStatus, addressOf } from './licenseStatus';

// Un locale nell'elenco: una riga con stato della licenza, prodotto e un solo pulsante, «Gestisci», che apre la finestra
// con tutte le azioni (components/master/TenantManage.jsx).
const TenantCard = ({ tenant: t, catalog, onOpen }) => {
  const status = licenseStatus(t);
  const product = (catalog?.businessTypes.find(b => b.id === t.business_type)?.label ?? t.business_type).split(' · ')[0];
  const users = Number(t.user_count);
  return (
    <article className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
          <h3 className="font-semibold text-[var(--text-main)] truncate">{t.name}</h3>
          {catalog && (
            <a href={addressOf(t.slug, catalog.appDomain)} target="_blank" rel="noreferrer" aria-label={`Apri ${t.name}`}
              className="text-[var(--text-muted)] hover:text-[var(--accent)] inline-flex items-center gap-1 text-sm shrink-0"><span className="hidden sm:inline">{t.slug}</span><ExternalLink size={12} /></a>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{status.label} · <span className="inline-flex items-center gap-1"><Users size={12} />{users} {users === 1 ? 'utente' : 'utenti'}</span></p>
      </div>
      <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium whitespace-nowrap">{product}</span>
      <button onClick={onOpen} className={btn}>Gestisci</button>
    </article>
  );
};

export default TenantCard;
