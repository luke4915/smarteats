import { Users, Clock, Power, Trash2, Printer, Blocks, ExternalLink, MessageSquare } from 'lucide-react';
import { btn, btnDanger } from '../../smarteats/floor/ui';
import { licenseStatus, addressOf } from './licenseStatus';

// Un locale nell'elenco: stato della licenza, tipo e moduli, e le azioni (moduli, utenti, scontrini, licenza, elimina).
// `on` raccoglie le azioni: modules, users, whatsapp, receipt, extend(days), toggle, remove.
const TenantCard = ({ tenant: t, catalog, on }) => {
  const status = licenseStatus(t);
  const typeLabel = catalog?.businessTypes.find(b => b.id === t.business_type)?.label ?? t.business_type;
  const small = `${btn} !h-9 !px-3`;
  return (
    <article className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
            <h3 className="font-semibold text-[var(--text-main)] truncate">{t.name}</h3>
            {catalog && (
              <a href={addressOf(t.slug, catalog.appDomain)} target="_blank" rel="noreferrer" aria-label={`Apri ${t.name}`}
                className="text-[var(--text-muted)] hover:text-[var(--accent)] inline-flex items-center gap-1 text-sm"><span>{t.slug}</span><ExternalLink size={12} /></a>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{status.label} · piano {t.plan} · <span className="inline-flex items-center gap-1"><Users size={12} />{Number(t.user_count)} {Number(t.user_count) === 1 ? 'utente' : 'utenti'}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">{typeLabel}</span>
          {t.modules?.map(id => (
            <span key={id} className="px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{catalog?.modules.find(m => m.id === id)?.label ?? id}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
        <button onClick={on.modules} className={small}><Blocks size={14} /> Moduli</button>
        <button onClick={on.users} className={small}><Users size={14} /> Utenti</button>
        {t.modules?.includes('whatsapp') && <button onClick={on.whatsapp} className={small}><MessageSquare size={14} /> WhatsApp</button>}
        <button onClick={on.receipt} className={small}><Printer size={14} /> Scontrini</button>
        <span className="hidden sm:block w-px h-6 bg-[var(--border)] mx-1" />
        <button onClick={() => on.extend(7)} className={small} title="Allunga la licenza di 7 giorni"><Clock size={14} /> +7 giorni</button>
        <button onClick={() => on.extend(30)} className={small} title="Allunga la licenza di 30 giorni"><Clock size={14} /> +30 giorni</button>
        <span className="flex-1" />
        <button onClick={on.toggle} className={small}><Power size={14} /> {t.active ? 'Disattiva' : 'Riattiva'}</button>
        <button onClick={on.remove} className={`${btnDanger} !h-9 !px-3`}><Trash2 size={14} /> Elimina</button>
      </div>
    </article>
  );
};

export default TenantCard;
