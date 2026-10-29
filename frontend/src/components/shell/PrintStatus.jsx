import { Printer } from 'lucide-react';
import { usePrintQueue } from '../../print/usePrintQueue';
import { chip } from './statusChip';

// Tiene viva la stampa del dispositivo (scarica la configurazione delle stampanti, svuota la coda, avvisa se una stampante non risponde)
// e in testata mostra solo le stampe ancora in attesa: un tocco riprova. Lo montano la cassa delle sagre (dentro SyncStatus) e SmartEats.
const PrintStatus = () => {
  const { pending, retryNow } = usePrintQueue();
  if (pending === 0) return null;
  return (
    <button onClick={retryNow} className={chip('amber')} title={`${pending} stampe in attesa: controlla la stampante. Tocca per riprovare`}>
      <Printer size={14} /><span className="tabular-nums">{pending}</span>
    </button>
  );
};

export default PrintStatus;
