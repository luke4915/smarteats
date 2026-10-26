import { useState } from 'react';
import { Lock } from 'lucide-react';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';
import { useReservedData } from '../../context/useReservedData';

// La scheda che prende il posto dei dati riservati: spiega cosa manca e chiede la password di un amministratore.
// Chi non è l'amministratore può farsela digitare da lui sul proprio dispositivo, senza conoscerla.
const UnlockCard = ({ what = 'Questi dati' }) => {
  const { unlock } = useReservedData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await unlock(password); setPassword(''); }
    catch (err) { setError(err.message || 'Non è stato possibile sbloccare'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto mt-10 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 shrink-0 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center text-[var(--text-muted)]"><Lock size={18} /></span>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-main)]">Dati riservati</h2>
          <p className="text-sm text-[var(--text-muted)]">{what} sono bloccati. Serve la password di un amministratore: restano visibili per 10 minuti.</p>
        </div>
      </div>
      <label className="block"><span className={`${label} block mb-1`}>Password dell'amministratore</span>
        <input type="password" className={input} aria-label="Password dell'amministratore" autoComplete="off" autoFocus value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || !password}>{busy ? 'Verifica…' : 'Sblocca'}</button>
    </form>
  );
};

export default UnlockCard;
