import { Users, Receipt, Clock } from 'lucide-react';
import PanelFrame from '../floor/PanelFrame';
import { formatEuro } from '../../utils/format';
import { btnPrimary } from '../floor/ui';

// Chi è seduto senza prenotazione (un blocco «Senza prenotazione» della Timeline): un tocco mostra qui un riepilogo, senza
// cambiare pagina. Per lavorare sul conto (comande, incasso) il pulsante in fondo porta in Sala, e lo dice chiaramente.
const CheckInfoPanel = ({ check, tableName, onBack, onOpen }) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(check.opened_at).getTime()) / 60000));
  const row = (Icon, label, value) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)]">
      <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Icon size={16} aria-hidden="true" />{label}</span>
      <span className="text-sm font-medium tabular-nums text-[var(--text-main)]">{value}</span>
    </div>
  );
  return (
    <PanelFrame title={tableName ?? 'Conto'} subtitle="Senza prenotazione" onBack={onBack}
      footer={<button className={`${btnPrimary} w-full !h-12`} onClick={onOpen}>Apri il conto in Sala</button>}>
      <div className="space-y-2">
        {row(Users, 'Persone', check.covers)}
        {row(Clock, 'Al tavolo da', `${minutes} min`)}
        {row(Receipt, 'Conto finora', formatEuro(check.total))}
        {check.bill_requested_at && <p className="text-sm font-medium text-amber-500 px-1 pt-1">Ha chiesto il conto</p>}
      </div>
    </PanelFrame>
  );
};

export default CheckInfoPanel;
