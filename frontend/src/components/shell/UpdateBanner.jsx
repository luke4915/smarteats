import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '../../hooks/useAppUpdate';

// «Nuova versione disponibile»: compare in alto quando l'app ha scaricato un aggiornamento che non può ancora mettere in
// uso da sola. Non blocca niente: chi lavora tocca «Aggiorna» quando preferisce (o l'app lo fa nel primo momento sicuro).
const UpdateBanner = () => {
  const { waiting, apply } = useAppUpdate();
  if (!waiting) return null;
  return (
    <div role="status" className="motion-page fixed left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-xl text-sm text-[var(--text-main)]"
      style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <span>Nuova versione disponibile</span>
      <button onClick={apply} className="h-9 px-4 rounded-full bg-[var(--accent)] text-white text-sm font-medium cursor-pointer inline-flex items-center gap-1.5">
        <RefreshCw size={14} />Aggiorna
      </button>
    </div>
  );
};

export default UpdateBanner;
