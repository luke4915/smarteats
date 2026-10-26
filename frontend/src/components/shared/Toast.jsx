import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';

// Messaggio breve, come le notifiche di iOS: una scheda di vetro con un'icona colorata e il testo. In alto sul telefono (così non
// copre la barra in basso), in basso su schermo largo. Sta sopra a tutto, finestre comprese.
const KINDS = {
  success: { icon: CheckCircle2, color: 'text-emerald-500' },
  error: { icon: CircleAlert, color: 'text-red-500' },
  warning: { icon: TriangleAlert, color: 'text-amber-500' },
  info: { icon: Info, color: 'text-[var(--accent)]' },
};

const Toast = ({ message, type = 'success', duration = 2000, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const { icon: Icon, color } = KINDS[type] ?? KINDS.info;
  return (
    <div role="status"
      className={`fixed top-[max(0.75rem,env(safe-area-inset-top))] md:top-auto md:bottom-6 left-1/2 -translate-x-1/2 z-[3000] w-max max-w-[calc(100vw-2rem)] sm:max-w-sm
        flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)]
        text-sm font-medium text-[var(--text-main)] transition-all duration-300 ease-in-out
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 md:translate-y-4 scale-95'}`}>
      <Icon size={20} className={`shrink-0 ${color}`} aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
};

export default Toast;
