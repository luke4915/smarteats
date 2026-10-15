import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isNotifySoundOn, setNotifySound } from '../../utils/notifySettings';
import { playChime } from '../../utils/chime';

// Suono delle notifiche: vale per questo dispositivo (ogni telefono o tablet sceglie per sé).
const NotificationSettings = () => {
  const [on, setOn] = useState(isNotifySoundOn);
  const toggle = () => {
    const next = !on;
    setOn(next); setNotifySound(next);
    if (next) playChime();             // si sente subito com'è
  };
  return (
    <section className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]" aria-label="Notifiche">
      <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Notifiche</h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">Una nuova richiesta di prenotazione o un ordine da asporto compare nella campanella in alto; qui scegli se deve anche suonare. Vale solo per questo dispositivo.</p>
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={on} aria-label="Suono delle notifiche" onClick={toggle}
          className={`shrink-0 w-11 h-6 p-0.5 rounded-full flex items-center cursor-pointer transition-colors ${on ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--border-hover)] justify-start'}`}>
          <span className="block w-5 h-5 bg-white rounded-full" />
        </button>
        <span className="text-sm text-[var(--text-main)] flex items-center gap-2">{on ? <Volume2 size={16} /> : <VolumeX size={16} />}{on ? 'Suono acceso' : 'Suono spento'}</span>
      </div>
    </section>
  );
};

export default NotificationSettings;
