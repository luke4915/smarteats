import { LockOpen } from 'lucide-react';
import UnlockCard from './UnlockCard';
import { unlockedUntilLabel } from './reservedLabels';
import { btn } from '../../smarteats/floor/ui';
import { useReservedData } from '../../context/useReservedData';
import { useToast } from '../../context/useToast';

// Avvolge una schermata fatta di dati riservati (report, statistiche): finché è bloccata mostra la scheda di sblocco e i dati
// non si chiedono nemmeno al server; sbloccata li mostra, con una riga che dice fino a quando e un modo per richiudere subito.
// Senza il blocco acceso (o per chi non è admin o responsabile) non cambia nulla.
const ReservedGate = ({ children, what }) => {
  const { ready, locked, unlockedUntil, lock } = useReservedData();
  const { showToast } = useToast();
  if (!ready) return <p className="text-sm text-[var(--text-muted)]">Caricamento…</p>;
  if (locked) return <UnlockCard what={what} />;
  return (
    <>
      {unlockedUntil && (
        <div className="flex items-center justify-end gap-3 mb-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><LockOpen size={14} /> Dati riservati sbloccati {unlockedUntilLabel(unlockedUntil)}</span>
          <button className={`${btn} !h-8 !px-3`} onClick={() => lock().catch(err => showToast(err.message, 'error'))}>Blocca ora</button>
        </div>)}
      {children}
    </>
  );
};

export default ReservedGate;
