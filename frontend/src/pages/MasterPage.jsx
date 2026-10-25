import { useState } from 'react';
import { ShieldCheck, LogOut, Plus, Search, X } from 'lucide-react';
import { useMaster } from '../components/master/useMaster';
import { countByKind, filterTenants, FILTERS } from '../components/master/licenseStatus';
import MasterLogin from '../components/master/MasterLogin';
import FeedbackPanel from '../components/master/FeedbackPanel';
import NewTenantForm from '../components/master/NewTenantForm';
import TenantCard from '../components/master/TenantCard';
import DeleteTenantModal from '../components/master/DeleteTenantModal';
import TenantReceiptEditor from '../components/master/TenantReceiptEditor';
import TenantManage from '../components/master/TenantManage';
import Segmented from '../smarteats/floor/Segmented';
import { btn, btnPrimary, input } from '../smarteats/floor/ui';

const Kpi = ({ label, value, tone }) => (
  <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
    <p className="text-xs text-[var(--text-muted)]">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? 'text-[var(--text-main)]'}`}>{value}</p>
  </div>
);

// La console del gestore (/master): crea i locali (tenant) e ne gestisce licenza, moduli, utenti e scontrini.
// Dati e azioni stanno in `useMaster`, ogni blocco dello schermo in components/master/. Qui si compone la pagina.
const MasterPage = () => {
  const m = useMaster();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  // Il locale aperto e cosa si sta facendo: { id, view: 'manage' | 'receipt' | 'delete' }. Si salva solo l'id: il locale si
  // rilegge dall'elenco, così la finestra mostra sempre i dati aggiornati (per esempio la nuova scadenza).
  const [open, setOpen] = useState(null);

  if (!m.authed) return <MasterLogin busy={m.busy} error={m.error} onLogin={m.login} />;

  const counts = countByKind(m.tenants);
  const visible = filterTenants(m.tenants, filter, query);
  const target = m.tenants.find(t => t.id === open?.id);
  const view = (name) => () => setOpen(o => ({ ...o, view: name }));

  return (
    <div className="app-safe h-dvh overflow-y-auto bg-[var(--bg-main)]">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-[var(--accent)]" />
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-main)] leading-tight">Console master</h1>
              <p className="text-sm text-[var(--text-muted)]">I locali e le loro licenze</p>
            </div>
          </div>
          <button onClick={m.logout} className={btn}><LogOut size={14} /> Esci</button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Locali" value={counts.all} />
          <Kpi label="Attivi" value={(counts.ok ?? 0) + (counts.soon ?? 0)} />
          <Kpi label="In scadenza (3 giorni)" value={counts.soon ?? 0} tone={counts.soon ? 'text-orange-500' : undefined} />
          <Kpi label="Scaduti" value={counts.expired ?? 0} tone={counts.expired ? 'text-red-500' : undefined} />
        </div>

        {m.error && !creating && <p className="text-sm text-red-500">{m.error}</p>}

        <FeedbackPanel feedback={m.feedback} onMark={m.markFeedback} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} !pl-9`} placeholder="Cerca un locale" aria-label="Cerca un locale" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <button onClick={() => { setCreating(o => !o); m.setError(''); }} className={btnPrimary}>
              {creating ? <><X size={16} /> Chiudi</> : <><Plus size={16} /> Nuovo locale</>}
            </button>
          </div>
          <Segmented label="Filtro" scroll value={filter} onChange={setFilter}
            options={FILTERS.filter(([id]) => id === 'all' || counts[id]).map(([id, label]) => ({ id, label: `${label} ${counts[id] ?? 0}` }))} />
        </section>

        {creating && <NewTenantForm catalog={m.catalog} error={m.error} onCreate={m.createTenant} onClose={() => setCreating(false)} />}

        <section className="space-y-2 pb-8">
          {visible.length === 0 && <p className="text-sm text-[var(--text-muted)] py-8 text-center">{m.tenants.length === 0 ? 'Nessun locale: creane uno con «Nuovo locale».' : 'Nessun locale corrisponde alla ricerca.'}</p>}
          {visible.map(t => <TenantCard key={t.id} tenant={t} catalog={m.catalog} onOpen={() => setOpen({ id: t.id, view: 'manage' })} />)}
        </section>
      </div>

      {target && m.catalog && open.view !== 'receipt' && (
        <TenantManage tenant={target} catalog={m.catalog} onSaved={m.loadTenants} onClose={() => open.view === 'manage' && setOpen(null)}
          on={{ extend: (days) => m.extend(target.id, days), toggle: () => m.setActive(target.id, !target.active), receipt: view('receipt'), remove: view('delete') }} />
      )}
      {target && open.view === 'receipt' && <TenantReceiptEditor tenant={target} onClose={view('manage')} />}
      {target && open.view === 'delete' && <DeleteTenantModal tenant={target} onClose={view('manage')} onConfirm={async () => { if (await m.deleteTenant(target)) setOpen(null); }} />}
    </div>
  );
};

export default MasterPage;
