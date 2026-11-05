import { TriangleAlert } from 'lucide-react';
import { useLicenseLock } from '../../hooks/useLicenseLock';
import { formatLeft } from '../../utils/licenseStatus';

// Avviso in testata per chi lavora con la licenza scaduta: finché c'è rete il server la controlla da sé, ma senza rete la cassa regge solo
// poche ore (offline/licenseLock.js). Compare dalle ultime 6 ore e dice quanto manca allo stop, così non ci si trova bloccati a metà serata.
const WARN_MINUTES = 6 * 60;

const LicenseNotice = () => {
  const { expired, minutesLeft } = useLicenseLock();
  if (!expired || minutesLeft === null || minutesLeft <= 0 || minutesLeft > WARN_MINUTES) return null;
  return (
    <div role="status" className="motion-page fixed left-1/2 -translate-x-1/2 z-[2900] flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-amber-500/40 shadow-xl text-sm text-[var(--text-main)] max-w-[calc(100vw-2rem)]"
      style={{ top: 'max(4.25rem, calc(env(safe-area-inset-top) + 3.5rem))' }}>
      <TriangleAlert size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
      <span className="min-w-0">Licenza scaduta: senza rete si lavora ancora {formatLeft(minutesLeft)}</span>
    </div>
  );
};

export default LicenseNotice;
