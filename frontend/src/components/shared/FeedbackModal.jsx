import { useState } from 'react';
import { Send } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import Modal from './Modal';
import ModalActions from './ModalActions';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';

// «Dicci cosa migliorare»: un suggerimento o una segnalazione, per modulo, che arriva a chi sviluppa l'app. Si apre dal menu
// dell'account (non sono impostazioni). `modules`: gli argomenti da offrire (la cassa delle sagre ne ha meno del ristorante).
const MODULES = [['general', 'In generale'], ['pos', 'Cassa'], ['floor', 'Sala'], ['reservations', 'Prenotazioni'], ['takeaway', 'Asporto'],
  ['kitchen', 'Cucina'], ['catalog', 'Carta e menu'], ['stats', 'Statistiche'], ['settings', 'Impostazioni']];
const STAND_MODULES = ['pos', 'kitchen', 'catalog', 'stats', 'settings'];

const FeedbackModal = ({ businessType, onClose }) => {
  const { showToast } = useToast();
  const [module, setModule] = useState('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const options = businessType === 'street_food' ? MODULES.filter(([id]) => id === 'general' || STAND_MODULES.includes(id)) : MODULES;

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetchWithAuth('/feedback', { method: 'POST', body: { module, message: message.trim() } });
      showToast('Grazie! Il tuo feedback è arrivato', 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); setBusy(false); }
  };

  return (
    <Modal title="Dicci cosa migliorare" size="max-w-lg" onClose={onClose} onSubmit={send}
      footer={<ModalActions onCancel={onClose}><button type="submit" className={btnPrimary} disabled={busy || message.trim().length < 3}><Send size={15} /> Invia</button></ModalActions>}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">Un'idea, qualcosa che non funziona o che non si capisce: lo leggiamo noi, di persona.</p>
        <label className="block"><span className={`${label} block mb-1`}>Di cosa parla</span>
          <select value={module} onChange={e => setModule(e.target.value)} className={input}>
            {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
        <label className="block"><span className={`${label} block mb-1`}>Il tuo messaggio</span>
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={5} placeholder="Scrivi qui…" autoFocus
            className={`${input} !h-auto py-2`} /></label>
      </div>
    </Modal>
  );
};

export default FeedbackModal;
