import { useState, useEffect } from 'react';
import Switch from '../shared/Switch';
import Modal from '../shared/Modal';
import ModalActions from '../shared/ModalActions';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useReservedData } from '../../context/useReservedData';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';

// Il blocco dei dati riservati (solo amministratore): con l'interruttore acceso costi, margini, prezzi dei fornitori e statistiche
// di incasso si vedono solo dopo aver digitato la password di un amministratore, e per 10 minuti. Vale sul server, non solo a schermo.
// Accendere è immediato; **spegnere chiede la password**, altrimenti un dispositivo lasciato aperto potrebbe togliere il blocco.
const ReservedDataSettings = () => {
  const { showToast } = useToast();
  const { refresh } = useReservedData();
  const [enabled, setEnabled] = useState(null);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchWithAuth('/settings/all').then(s => setEnabled(s.reserved_data_lock === '1')).catch(err => showToast(err.message, 'error'));
  }, [showToast]);

  const turnOn = async () => {
    try {
      await fetchWithAuth('/settings/reserved_data_lock', { method: 'PUT', body: { value: '1' } });
      setEnabled(true);
      await refresh();
      showToast('Dati riservati bloccati', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const closeAsk = () => { setAsking(false); setPassword(''); setError(''); };

  const turnOff = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await fetchWithAuth('/reserved-data/disable', { method: 'POST', body: { password } });
      setEnabled(false);
      closeAsk();
      await refresh();
      showToast('Dati riservati sempre visibili', 'success');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Blocca i dati riservati</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-xl">
            Costi, margini, prezzi dei fornitori e statistiche di incasso restano nascosti. Per vederli serve la password di un amministratore, e si richiudono dopo 10 minuti.
            Chi non è amministratore può chiedere di digitarla sul proprio dispositivo, senza conoscerla. Anche per togliere il blocco serve la tua password.
          </p>
        </div>
        <Switch checked={!!enabled} onChange={(next) => (next ? turnOn() : setAsking(true))} label="Blocca i dati riservati" disabled={enabled === null} />
      </div>

      {asking && (
        <Modal title="Togliere il blocco?" size="max-w-md" onClose={closeAsk} onSubmit={turnOff}
          footer={<ModalActions onCancel={closeAsk}><button type="submit" className={btnPrimary} disabled={busy || !password}>{busy ? 'Verifica…' : 'Togli il blocco'}</button></ModalActions>}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">Costi, margini e incassi torneranno visibili a tutti. Scrivi la tua password per confermare.</p>
            <label className="block"><span className={`${label} block mb-1`}>La tua password</span>
              <input type="password" className={input} autoComplete="current-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReservedDataSettings;
