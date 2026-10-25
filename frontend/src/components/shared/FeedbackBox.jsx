import { useState } from 'react';
import { Send } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { btnPrimary, input } from '../../smarteats/floor/ui';

// «Dicci cosa migliorare»: un suggerimento o una segnalazione, per modulo, che arriva a chi sviluppa l'app.
const MODULES = [['general', 'In generale'], ['pos', 'Cassa'], ['floor', 'Sala'], ['reservations', 'Prenotazioni'], ['takeaway', 'Asporto'],
  ['kitchen', 'Cucina'], ['catalog', 'Carta e menu'], ['stats', 'Statistiche'], ['settings', 'Impostazioni']];

const FeedbackBox = ({ modules = null }) => {
  const { showToast } = useToast();
  const [module, setModule] = useState('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const options = modules ? MODULES.filter(([id]) => id === 'general' || modules.includes(id)) : MODULES;

  const send = async () => {
    setBusy(true);
    try {
      await fetchWithAuth('/feedback', { method: 'POST', body: { module, message: message.trim() } });
      setMessage('');
      showToast('Grazie! Il tuo feedback è arrivato', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]" aria-label="Feedback">
      <h2 className="text-base font-semibold text-[var(--text-main)] mb-1">Dicci cosa migliorare</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">Un'idea, qualcosa che non funziona o che non si capisce: lo leggiamo noi, di persona.</p>
      <div className="space-y-3 max-w-2xl">
        <label className="block"><span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Di cosa parla</span>
          <select value={module} onChange={e => setModule(e.target.value)}
            className={input}>
            {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
        <label className="block"><span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Il tuo messaggio</span>
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={4} placeholder="Scrivi qui…"
            className={`${input} !h-auto py-2`} /></label>
        <button onClick={send} disabled={busy || message.trim().length < 3}
          className={btnPrimary}><Send size={15} /> Invia</button>
      </div>
    </section>
  );
};

export default FeedbackBox;
