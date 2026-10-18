import { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../shared/Modal';
import { btnPrimary } from '../../smarteats/floor/ui';
import { apiFetch } from '../../utils/apiClient';
import ModulePicker from './ModulePicker';

// Tipo di attività e moduli di un tenant esistente. Vale subito: gli utenti lo vedono al prossimo accesso o rinnovo.
const TenantModules = ({ tenant, catalog, onClose, onSaved }) => {
  const [value, setValue] = useState({ businessType: tenant.business_type, modules: tenant.modules });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await apiFetch(`/master/tenants/${tenant.id}/modules`, { method: 'PUT', body: { modules: value.modules } });
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Moduli · ${tenant.name}`} size="max-w-lg" onClose={onClose}
      footer={<button onClick={save} disabled={saving} className={btnPrimary}><Save size={16} /> {saving ? 'Salvataggio…' : 'Salva'}</button>}>
      <ModulePicker catalog={catalog} value={value} onChange={setValue} typeLocked />
      {error && <p className="text-red-500 text-xs font-medium mt-3">{error}</p>}
    </Modal>
  );
};

export default TenantModules;
