import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, LogOut, Users, Clock, Power, Trash2, Plus, Printer, Blocks, Search, ExternalLink, X } from 'lucide-react';
import { apiFetch, ApiError } from '../utils/apiClient';
import TenantReceiptEditor from '../components/master/TenantReceiptEditor';
import TenantUsers from '../components/master/TenantUsers';
import ModulePicker from '../components/master/ModulePicker';
import TenantModules from '../components/master/TenantModules';
import TempPasswordField from '../components/shared/TempPasswordField';

// Console del gestore: crea i locali (tenant), ne gestisce licenza, moduli, utenti e scontrini. Stesso linguaggio
// visivo delle app (testo normale, un solo colore d'accento, niente maiuscolo spaziato).
const input = 'h-10 w-full px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none placeholder:text-[var(--text-muted)]';
const btn = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer disabled:opacity-50';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-[var(--text-main)] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-[var(--text-muted)] mt-1">{hint}</span>}
  </label>
);

const Kpi = ({ label, value, tone }) => (
  <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
    <p className="text-xs text-[var(--text-muted)]">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? 'text-[var(--text-main)]'}`}>{value}</p>
  </div>
);

const DAY = 1000 * 60 * 60 * 24;
// Stato della licenza: `kind` serve ai filtri, `label` e `dot` alla riga.
const licenseStatus = (t) => {
  if (!t.active) return { kind: 'off', label: 'Disattivato', dot: 'bg-gray-400' };
  if (!t.expires_at) return { kind: 'ok', label: 'Senza scadenza', dot: 'bg-blue-500' };
  const daysLeft = (new Date(t.expires_at) - Date.now()) / DAY;
  const until = new Date(t.expires_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  if (daysLeft < 0) return { kind: 'expired', label: `Scaduto il ${until}`, dot: 'bg-red-500' };
  if (daysLeft < 3) return { kind: 'soon', label: `Scade ${daysLeft < 1 ? 'oggi' : `tra ${Math.ceil(daysLeft)} giorni`} · ${until}`, dot: 'bg-orange-500' };
  return { kind: 'ok', label: `Attivo fino al ${until}`, dot: 'bg-green-500' };
};

const FILTERS = [['all', 'Tutti'], ['ok', 'Attivi'], ['soon', 'In scadenza'], ['expired', 'Scaduti'], ['off', 'Disattivati']];
const LICENSE_PRESETS = [7, 30, 90, 365];
const slugify = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
// Indirizzo del locale: stesso dominio e porta della console, con il suo sottodominio.
const addressOf = (slug) => {
  const { protocol, hostname, port } = window.location;
  const base = hostname.split('.').slice(1).join('.') || hostname;
  return `${protocol}//${slug}.${base}${port ? `:${port}` : ''}`;
};

// ─── Conferma eliminazione ───
const DeleteTenantModal = ({ tenant, onConfirm, onClose }) => {
  const [typed, setTyped] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-[var(--text-main)] mb-1 text-center">Eliminare «{tenant.name}»?</p>
        <p className="text-sm text-[var(--text-muted)] mb-4 text-center">
          Non si può annullare: spariscono anche prodotti, ordini e utenti. Scrivi <b className="text-[var(--text-main)]">{tenant.slug}</b> per confermare.
        </p>
        <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder={tenant.slug} className={`${input} mb-4`} />
        <div className="flex gap-3">
          <button onClick={onClose} className={`${btn} flex-1 !h-10`}>Annulla</button>
          <button onClick={() => typed === tenant.slug && onConfirm()} disabled={typed !== tenant.slug}
            className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer">Elimina</button>
        </div>
      </div>
    </div>
  );
};

const MasterPage = () => {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [usersTarget, setUsersTarget] = useState(null);
  const [modulesTarget, setModulesTarget] = useState(null);
  const [catalog, setCatalog] = useState(null);

  const emptyForm = { slug: '', name: '', plan: 'trial', expiresInDays: 7, adminUsername: '', adminPassword: '', businessType: 'sagra', modules: ['kds', 'stats', 'qr_menu'] };
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const loadTenants = useCallback(async () => {
    try {
      setTenants(await apiFetch('/master/tenants'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuthed(false);
      else setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadTenants();
    apiFetch('/master/catalog').then(setCatalog).catch(err => setError(err.message));
  }, [authed, loadTenants]);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      await apiFetch('/master/login', { method: 'POST', body: { password } });
      setAuthed(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await apiFetch('/master/logout', { method: 'POST' }).catch(() => {});
    setAuthed(false); setPassword(''); setTenants([]);
  };

  const handleCreateTenant = async () => {
    setCreating(true); setError('');
    try {
      await apiFetch('/master/tenants', { method: 'POST', body: form });
      setForm(emptyForm); setSlugTouched(false); setCreatingOpen(false);
      loadTenants();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const handleExtend = async (id, days) => {
    setError('');
    try {
      await apiFetch(`/master/tenants/${id}/extend`, { method: 'PATCH', body: { days } });
      loadTenants();
    } catch (err) { setError(err.message); }
  };

  const handleToggleActive = async (id, active) => {
    setError('');
    try {
      await apiFetch(`/master/tenants/${id}/active`, { method: 'PATCH', body: { active } });
      loadTenants();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async () => {
    setError('');
    try {
      await apiFetch(`/master/tenants/${deleteTarget.id}`, { method: 'DELETE', body: { confirmSlug: deleteTarget.slug } });
      setDeleteTarget(null);
      loadTenants();
    } catch (err) { setError(err.message); }
  };

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-main)] p-6">
        <div className="w-full max-w-xs">
          <div className="flex flex-col items-center mb-6">
            <ShieldCheck size={36} className="text-[var(--accent)] mb-3" />
            <h1 className="text-xl font-semibold text-[var(--text-main)]">Console master</h1>
            <p className="text-sm text-[var(--text-muted)]">Area riservata al gestore</p>
          </div>
          <div className="flex flex-col gap-3">
            <input type="password" placeholder="Password" aria-label="Password master" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className={input} autoFocus />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleLogin} disabled={loading} className={`${btnPrimary} w-full`}>{loading ? 'Accesso…' : 'Entra'}</button>
          </div>
        </div>
      </div>
    );
  }

  const counts = { all: tenants.length };
  for (const t of tenants) { const k = licenseStatus(t).kind; counts[k] = (counts[k] ?? 0) + 1; }
  const visible = tenants.filter(t => (filter === 'all' || licenseStatus(t).kind === filter)
    && (!query.trim() || `${t.name} ${t.slug}`.toLowerCase().includes(query.trim().toLowerCase())));

  const typeLabel = (id) => catalog?.businessTypes.find(b => b.id === id)?.label ?? id;
  const canCreate = form.slug && form.name.trim() && form.adminUsername.trim() && form.adminPassword.length >= 8;

  return (
    <div className="h-screen overflow-y-auto bg-[var(--bg-main)]">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-[var(--accent)]" />
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-main)] leading-tight">Console master</h1>
              <p className="text-sm text-[var(--text-muted)]">I locali e le loro licenze</p>
            </div>
          </div>
          <button onClick={handleLogout} className={btn}><LogOut size={14} /> Esci</button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Locali" value={counts.all} />
          <Kpi label="Attivi" value={(counts.ok ?? 0) + (counts.soon ?? 0)} />
          <Kpi label="In scadenza (3 giorni)" value={counts.soon ?? 0} tone={counts.soon ? 'text-orange-500' : undefined} />
          <Kpi label="Scaduti" value={counts.expired ?? 0} tone={counts.expired ? 'text-red-500' : undefined} />
        </div>

        {error && !creatingOpen && <p className="text-sm text-red-500">{error}</p>}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} pl-9`} placeholder="Cerca un locale" aria-label="Cerca un locale" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <button onClick={() => { setCreatingOpen(o => !o); setError(''); }} className={btnPrimary}>
              {creatingOpen ? <><X size={16} /> Chiudi</> : <><Plus size={16} /> Nuovo locale</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtro">
            {FILTERS.filter(([id]) => id === 'all' || counts[id]).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                className={`h-8 px-3 rounded-full text-sm font-medium border transition-colors cursor-pointer ${filter === id ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                {label} <span className="tabular-nums opacity-70">{counts[id] ?? 0}</span>
              </button>
            ))}
          </div>
        </section>

        {creatingOpen && (
          <section className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)] space-y-5">
            <h2 className="text-base font-semibold text-[var(--text-main)]">Nuovo locale</h2>

            <div>
              <p className="text-sm font-medium text-[var(--text-main)] mb-1.5">1. Tipo di attività e moduli</p>
              {catalog
                ? <ModulePicker catalog={catalog} value={{ businessType: form.businessType, modules: form.modules }} onChange={v => setForm(f => ({ ...f, ...v }))} />
                : <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--text-main)]">2. Il locale</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nome del locale">
                  <input className={input} placeholder="Es. Sagra del Calzone" value={form.name}
                    onChange={e => { const name = e.target.value; setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) })); }} />
                </Field>
                <Field label="Indirizzo" hint={form.slug ? addressOf(form.slug).replace(/^https?:\/\//, '') : 'Solo lettere minuscole, numeri e trattini'}>
                  <input className={input} placeholder="sagra-del-calzone" value={form.slug}
                    onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }} />
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--text-main)]">3. Licenza</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Durata">
                  <div className="flex flex-wrap gap-1.5">
                    {LICENSE_PRESETS.map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, expiresInDays: d }))} aria-pressed={form.expiresInDays === d}
                        className={`h-10 px-3 rounded-lg border text-sm font-medium cursor-pointer ${form.expiresInDays === d ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                        {d === 365 ? '1 anno' : `${d} giorni`}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Piano" hint="Solo un'etichetta per te, es. prova, base, completo">
                  <input className={input} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} />
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--text-main)]">4. Primo amministratore</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nome utente">
                  <input className={input} placeholder="Es. admin" autoComplete="off" value={form.adminUsername} onChange={e => setForm(f => ({ ...f, adminUsername: e.target.value }))} />
                </Field>
                <Field label="Password temporanea" hint="La dovrà cambiare al primo accesso. Genera e copia per passargliela.">
                  <TempPasswordField className={input} placeholder="Almeno 8 caratteri" value={form.adminPassword} onChange={adminPassword => setForm(f => ({ ...f, adminPassword }))} />
                </Field>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center gap-3">
              <button onClick={handleCreateTenant} disabled={creating || !canCreate} className={btnPrimary}>{creating ? 'Creazione…' : 'Crea il locale'}</button>
              {!canCreate && <span className="text-xs text-[var(--text-muted)]">Mancano nome, indirizzo, utente o una password di almeno 8 caratteri.</span>}
            </div>
          </section>
        )}

        <section className="space-y-2 pb-8">
          {visible.length === 0 && <p className="text-sm text-[var(--text-muted)] py-8 text-center">{tenants.length === 0 ? 'Nessun locale: creane uno con «Nuovo locale».' : 'Nessun locale corrisponde alla ricerca.'}</p>}
          {visible.map(t => {
            const status = licenseStatus(t);
            return (
              <article key={t.id} className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
                      <h3 className="font-semibold text-[var(--text-main)] truncate">{t.name}</h3>
                      <a href={addressOf(t.slug)} target="_blank" rel="noreferrer" aria-label={`Apri ${t.name}`}
                        className="text-[var(--text-muted)] hover:text-[var(--accent)] inline-flex items-center gap-1 text-sm"><span>{t.slug}</span><ExternalLink size={12} /></a>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{status.label} · piano {t.plan} · <span className="inline-flex items-center gap-1"><Users size={12} />{Number(t.user_count)} {Number(t.user_count) === 1 ? 'utente' : 'utenti'}</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">{typeLabel(t.business_type)}</span>
                    {t.modules?.map(id => (
                      <span key={id} className="px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{catalog?.modules.find(m => m.id === id)?.label ?? id}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
                  <button onClick={() => catalog && setModulesTarget(t)} className={btn}><Blocks size={14} /> Moduli</button>
                  <button onClick={() => setUsersTarget(t)} className={btn}><Users size={14} /> Utenti</button>
                  <button onClick={() => setReceiptTarget(t)} className={btn}><Printer size={14} /> Scontrini</button>
                  <span className="hidden sm:block w-px h-6 bg-[var(--border)] mx-1" />
                  <button onClick={() => handleExtend(t.id, 7)} className={btn} title="Allunga la licenza di 7 giorni"><Clock size={14} /> +7 giorni</button>
                  <button onClick={() => handleExtend(t.id, 30)} className={btn} title="Allunga la licenza di 30 giorni"><Clock size={14} /> +30 giorni</button>
                  <span className="flex-1" />
                  <button onClick={() => handleToggleActive(t.id, !t.active)} className={btn}><Power size={14} /> {t.active ? 'Disattiva' : 'Riattiva'}</button>
                  <button onClick={() => setDeleteTarget(t)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors cursor-pointer"><Trash2 size={14} /> Elimina</button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {modulesTarget && catalog && <TenantModules tenant={modulesTarget} catalog={catalog} onClose={() => setModulesTarget(null)} onSaved={loadTenants} />}
      {usersTarget && <TenantUsers tenant={usersTarget} onClose={() => setUsersTarget(null)} onChanged={loadTenants} />}
      {receiptTarget && <TenantReceiptEditor tenant={receiptTarget} onClose={() => setReceiptTarget(null)} />}
      {deleteTarget && <DeleteTenantModal tenant={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </div>
  );
};

export default MasterPage;
