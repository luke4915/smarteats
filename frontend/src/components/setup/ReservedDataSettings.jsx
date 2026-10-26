import { useState, useEffect } from 'react';
import Switch from '../shared/Switch';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useReservedData } from '../../context/useReservedData';

// Il blocco dei dati riservati (solo amministratore): con l'interruttore acceso costi, margini, prezzi dei fornitori e statistiche
// di incasso si vedono solo dopo aver digitato la password di un amministratore, e per 10 minuti. Vale sul server, non solo a schermo.
const ReservedDataSettings = () => {
  const { showToast } = useToast();
  const { refresh } = useReservedData();
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    fetchWithAuth('/settings/all').then(s => setEnabled(s.reserved_data_lock === '1')).catch(err => showToast(err.message, 'error'));
  }, [showToast]);

  const change = async (next) => {
    try {
      await fetchWithAuth('/settings/reserved_data_lock', { method: 'PUT', body: { value: next ? '1' : '0' } });
      setEnabled(next);
      await refresh();
      showToast(next ? 'Dati riservati bloccati' : 'Dati riservati sempre visibili', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Blocca i dati riservati</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-xl">
            Costi, margini, prezzi dei fornitori e statistiche di incasso restano nascosti. Per vederli serve la password di un amministratore, e si richiudono dopo 10 minuti.
            Chi non è amministratore può chiedere di digitarla sul proprio dispositivo, senza conoscerla.
          </p>
        </div>
        <Switch checked={!!enabled} onChange={change} label="Blocca i dati riservati" disabled={enabled === null} />
      </div>
    </div>
  );
};

export default ReservedDataSettings;
