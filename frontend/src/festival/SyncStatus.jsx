import { useState } from 'react';
import { CloudOff, RefreshCw, AlertTriangle, Printer, WifiOff } from 'lucide-react';
import { useOfflineSync } from '../offline/useOfflineSync';
import { usePrintQueue } from '../print/usePrintQueue';
import FailedOrdersModal from '../components/shared/FailedOrdersModal';

const chip = (tone) => `flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${tone === 'red'
  ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
  : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'}`;

// Cosa chiede attenzione alla cassa, mostrato in testata solo quando serve: sei offline o ci sono ordini da inviare,
// stampe in attesa, ordini rifiutati dal server, server non raggiungibile. Un tocco riprova o apre i dettagli.
const SyncStatus = ({ connected }) => {
  const { online, pending, failed, syncNow, refreshCounts } = useOfflineSync();
  const { pending: printPending, retryNow: retryPrint } = usePrintQueue();
  const [showFailed, setShowFailed] = useState(false);

  return (
    <>
      {(!online || pending > 0) && (
        <button onClick={syncNow} className={chip('amber')} title={!online ? 'Sei offline (ordini salvati in locale)' : `${pending} ordini in attesa di invio`}>
          {online ? <RefreshCw size={14} className="animate-spin" /> : <CloudOff size={14} />}
          {pending > 0 && <span className="tabular-nums">{pending}</span>}
        </button>
      )}
      {printPending > 0 && (
        <button onClick={retryPrint} className={chip('amber')} title={`${printPending} stampe in attesa: controlla la stampante. Tocca per riprovare`}>
          <Printer size={14} /><span className="tabular-nums">{printPending}</span>
        </button>
      )}
      {failed > 0 && (
        <button onClick={() => setShowFailed(true)} className={chip('red')} title={`${failed} ordini offline rifiutati dal server: tocca per vederli`}>
          <AlertTriangle size={14} /><span className="tabular-nums">{failed}</span>
        </button>
      )}
      {online && !connected && (
        <span className={`${chip('red')} cursor-default`} title="Il server non è raggiungibile"><WifiOff size={14} /></span>
      )}
      {showFailed && <FailedOrdersModal onClose={() => setShowFailed(false)} onChanged={() => { refreshCounts(); syncNow(); }} />}
    </>
  );
};

export default SyncStatus;
