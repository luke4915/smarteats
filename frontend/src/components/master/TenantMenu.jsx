import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';
import { apiFetch } from '../../utils/apiClient';
import Loading from '../shared/Loading';

// Scheda «Menu pubblico» della finestra di un locale (solo se ha il modulo menu QR): il messaggio di benvenuto che i clienti leggono
// aprendo il QR. Lo scrive solo il master: il locale lo vede in Impostazioni → Menu pubblico, senza poterlo cambiare.
const MAX = 300;

const TenantMenu = ({ tenant }) => {
  const [saved, setSaved] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/master/tenants/${tenant.id}/menu`).then(d => { setSaved(d.welcome_message); setText(d.welcome_message); }).catch(err => setError(err.message));
  }, [tenant.id]);

  const save = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const d = await apiFetch(`/master/tenants/${tenant.id}/menu`, { method: 'PUT', body: { welcome_message: text } });
      setSaved(d.welcome_message); setText(d.welcome_message); setNote('Salvato');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (saved === null && !error) return <Loading />;
  return (
    <div className="space-y-3 max-w-2xl">
      <div>
        <label className={label} htmlFor="tenant-welcome">Messaggio di benvenuto sul menu con il QR</label>
        <textarea id="tenant-welcome" className={`${input} mt-1 !h-28 py-2`} value={text} maxLength={MAX} placeholder="Es. Benvenuti alla Sagra del Calzone 2026! Il forno parte alle 19."
          onChange={e => { setText(e.target.value); setNote(''); }} />
        <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">{text.length}/{MAX} · Lascia vuoto per non mostrare nulla.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button className={btnPrimary} disabled={busy || text.trim() === saved} onClick={save}><Save size={16} /> {busy ? 'Salvataggio…' : 'Salva'}</button>
        {note && <span className="text-sm text-emerald-500">{note}</span>}
      </div>
    </div>
  );
};

export default TenantMenu;
