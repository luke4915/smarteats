import { useState } from 'react';
import { Save } from 'lucide-react';
import { btnPrimary } from '../../smarteats/floor/ui';
import { apiFetch } from '../../utils/apiClient';
import ModulePicker from './ModulePicker';

// Scheda «Moduli» della finestra di un locale: tipo di attività (fisso) e moduli accesi. Vale subito: gli utenti lo vedono
// al prossimo accesso o rinnovo.
const TenantModules = ({ tenant, catalog, onSaved }) => {
  const [value, setValue] = useState({ businessType: tenant.business_type, modules: tenant.modules });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError(''); setNote('');
    try {
      await apiFetch(`/master/tenants/${tenant.id}/modules`, { method: 'PUT', body: { modules: value.modules } });
      await onSaved();
      setNote('Salvato');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <ModulePicker catalog={catalog} value={value} onChange={setValue} typeLocked />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}><Save size={16} /> {saving ? 'Salvataggio…' : 'Salva'}</button>
        {note && <span className="text-sm text-emerald-500">{note}</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
};

export default TenantModules;
