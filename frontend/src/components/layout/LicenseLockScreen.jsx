import { LockKeyhole } from 'lucide-react';
import CenteredScreen from './CenteredScreen';
import { btnPrimary } from '../../smarteats/floor/ui';

// La cassa è senza rete da più di 10 ore dalla scadenza della licenza: tutto fermo finché non torna online e il server conferma o rinnova.
// Gli ordini già battuti restano al sicuro sul dispositivo e partono al ritorno della rete (se rientrano nelle ore consentite).
const LicenseLockScreen = () => (
  <CenteredScreen>
    <div className="max-w-sm text-center space-y-4">
      <span className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center"><LockKeyhole size={26} /></span>
      <h1 className="text-xl font-semibold text-[var(--text-main)]">Collegati a internet per continuare</h1>
      <p className="text-sm text-[var(--text-muted)]">La licenza è scaduta e questo dispositivo è rimasto senza rete oltre il tempo consentito. Appena torna la connessione l'app controlla da sola e, se la licenza è rinnovata, riparte.</p>
      <p className="text-sm text-[var(--text-muted)]">Gli ordini già battuti sono al sicuro e vengono inviati appena possibile.</p>
      <button className={`${btnPrimary} w-full`} onClick={() => window.location.reload()}>Riprova</button>
    </div>
  </CenteredScreen>
);

export default LicenseLockScreen;
