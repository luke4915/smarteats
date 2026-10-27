import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import Modal from '../shared/Modal';
import { btnPrimary } from '../../smarteats/floor/ui';
import { CHANGELOG } from '../../changelog';
import { APP_VERSION } from '../../utils/appVersion';
import { entriesToShow } from '../../utils/whatsNew';

const KEY = 'whatsNewSeen';
const PUBLIC = /^\/(book|order|menu|privacy|terms|s|kds|master)(\/|$)/;

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* senza archivio locale si rivede la prossima volta */ } };

// Dopo un aggiornamento mostra a chi gestisce il locale (admin e responsabile) cosa è cambiato, una sola volta per
// dispositivo. Non c'è un archivio da consultare: chi ha già visto le novità non le ritrova.
const WhatsNew = () => {
  const { user } = useAuth();
  const [closed, setClosed] = useState(false);
  const [seen] = useState(read);                         // l'ultima versione vista, com'era all'apertura dell'app
  const eligible = !!user && !user.needsPassword && ['admin', 'manager'].includes(user.role) && !PUBLIC.test(window.location.pathname) && APP_VERSION !== 'dev';
  useEffect(() => { if (eligible && !seen) write(APP_VERSION); }, [eligible, seen]);   // primo accesso: da qui si annunciano gli aggiornamenti

  const entries = eligible ? entriesToShow(CHANGELOG, seen, APP_VERSION) : [];
  if (closed || entries.length === 0) return null;

  const close = () => { write(APP_VERSION); setClosed(true); };
  return (
    <Modal title="Novità" onClose={close} size="max-w-md"
      footer={<button type="button" onClick={close} className={`${btnPrimary} w-full`}>Ho capito</button>}>
      <div className="space-y-5">
        {entries.map(e => (
          <section key={e.version}>
            <h4 className="text-sm font-semibold text-[var(--text-main)] mb-2">Versione {e.version}</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)] list-disc pl-5">{e.items.map(t => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
      </div>
    </Modal>
  );
};

export default WhatsNew;
