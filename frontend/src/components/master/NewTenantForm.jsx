import { useState } from 'react';
import ModulePicker from './ModulePicker';
import TempPasswordField from '../shared/TempPasswordField';
import Segmented from '../../smarteats/floor/Segmented';
import { btnPrimary, input } from '../../smarteats/floor/ui';
import { LICENSE_PRESETS, slugify, addressOf } from './licenseStatus';

const EMPTY = { slug: '', name: '', plan: 'trial', expiresInDays: 7, adminUsername: '', adminPassword: '', businessType: 'street_food', modules: ['kds', 'stats', 'qr_menu'] };

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-[var(--text-main)] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-[var(--text-muted)] mt-1">{hint}</span>}
  </label>
);

// Il modulo per creare un locale, in quattro passi: tipo e moduli, nome e indirizzo, licenza, primo amministratore.
// `onCreate(form)` dice se è riuscita (allora il modulo si azzera e si chiude).
const NewTenantForm = ({ catalog, error, onCreate, onClose }) => {
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const canCreate = form.slug && form.name.trim() && form.adminUsername.trim() && form.adminPassword.length >= 8;

  const submit = async () => {
    setCreating(true);
    const ok = await onCreate(form);
    setCreating(false);
    if (ok) onClose();
  };

  return (
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
          <Field label="Indirizzo" hint={form.slug && catalog ? addressOf(form.slug, catalog.appDomain).replace(/^https?:\/\//, '') : 'Solo lettere minuscole, numeri e trattini'}>
            <input className={input} placeholder="sagra-del-calzone" value={form.slug}
              onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }} />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--text-main)]">3. Licenza</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Durata">
            <Segmented label="Durata" scroll value={form.expiresInDays} onChange={(d) => setForm(f => ({ ...f, expiresInDays: d }))}
              options={LICENSE_PRESETS.map(d => ({ id: d, label: d === 365 ? '1 anno' : `${d} giorni` }))} />
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
        <button onClick={submit} disabled={creating || !canCreate} className={btnPrimary}>{creating ? 'Creazione…' : 'Crea il locale'}</button>
        {!canCreate && <span className="text-xs text-[var(--text-muted)]">Mancano nome, indirizzo, utente o una password di almeno 8 caratteri.</span>}
      </div>
    </section>
  );
};

export default NewTenantForm;
