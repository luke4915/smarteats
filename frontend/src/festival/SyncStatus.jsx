import { useState } from 'react';
import { CloudOff, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { useOfflineSync } from '../offline/useOfflineSync';
import PrintStatus from '../components/shell/PrintStatus';
import { chip } from '../components/shell/statusChip';
import FailedOrdersModal from '../components/shared/FailedOrdersModal';

// Cosa chiede attenzione alla cassa, mostrato in testata solo quando serve: sei offline o ci sono ordini da inviare,
// stampe in attesa, ordini rifiutati dal server, server non raggiungibile. Un tocco riprova o apre i dettagli.
const SyncStatus = ({ connected }) => {
  const { online, pending, failed, syncNow, refreshCounts } = useOfflineSync();
  const [showFailed, setShowFailed] = useState(false);

  return (
    <>
      {(!online || pending > 0) && (
        <button onClick={syncNow} className={chip('amber')} title={!online ? 'Sei offline (ordini salvati in locale)' : `${pending} ordini in attesa di invio`}>
          {online ? <RefreshCw size={14} className="animate-spin" /> : <CloudOff size={14} />}
          {pending > 0 && <span className="tabular-nums">{pending}</span>}
        </button>
      )}
      <PrintStatus />
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
