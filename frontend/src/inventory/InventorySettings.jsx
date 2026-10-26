import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { input } from '../smarteats/floor/ui';

const RATES = ['4', '5', '10', '22', '0'];

// Le impostazioni del magazzino: l'IVA predefinita, usata nei margini per i piatti che non ne hanno una propria.
// Si sceglie fra le aliquote più comuni; il prezzo in carta resta quello con IVA.
const InventorySettings = () => {
  const { showToast } = useToast();
  const [value, setValue] = useState('10');
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    fetchWithAuth('/settings/all')
      .then(s => { const v = s.default_vat_rate ? String(Number(String(s.default_vat_rate).replace(',', '.'))) : '10'; setValue(v); setSaved(v); })
      .catch(err => showToast(err.message, 'error'));
  }, [showToast]);

  const save = async () => {
    try {
      await fetchWithAuth('/settings/default_vat_rate', { method: 'PUT', body: { value } });
      setSaved(value);
      showToast('IVA predefinita salvata', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">IVA predefinita</h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">Serve a calcolare i margini sul ricavo senza IVA. Un piatto può avere la sua aliquota dalla scheda del prodotto.</p>
      <div className="flex gap-2 max-w-xs">
        <select className={input} aria-label="IVA predefinita" value={value} onChange={e => setValue(e.target.value)} disabled={saved === null}>
          {RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
        </select>
        <button className="px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm disabled:opacity-40" disabled={saved === null || value === saved} onClick={save}>Salva</button>
      </div>
    </div>
  );
};

export default InventorySettings;
