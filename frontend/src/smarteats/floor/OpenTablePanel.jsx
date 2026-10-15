import { useState } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from './PanelFrame';
import CoversStepper from './CoversStepper';
import { btnPrimary, btn } from './ui';

// Un tavolo libero: si scelgono i coperti e si apre il conto, nello stesso pannello del conto. Se il tavolo ha una
// prenotazione confermata compare in cima, con «Arrivato»: apre il conto con i coperti della prenotazione.
const OpenTablePanel = ({ table, reservation = null, onBack, onOpened, onBusy }) => {
  const { showToast } = useToast();
  const [covers, setCovers] = useState(reservation?.party_size ?? table.seats);
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try { onOpened(await action()); }
    catch (err) {
      showToast(err.message, 'error');
      if (err.code === 'TABLE_BUSY') onBusy(); // lo ha aperto qualcun altro un istante prima
    } finally { setBusy(false); }
  };
  const open = () => run(() => fetchWithAuth('/checks', { method: 'POST', body: { table_id: table.id, covers } }));
  const arrived = () => run(async () => (await fetchWithAuth(`/bookings/reservations/${reservation.id}/arrived`, { method: 'POST', body: { table_id: table.id } })).check);

  return (
    <PanelFrame title={table.name} subtitle={`Libero · ${table.seats} posti`} onBack={onBack}
      footer={
        reservation ? (
          <div className="space-y-2">
            <button className={`${btnPrimary} w-full !h-12`} disabled={busy} onClick={arrived}>Arrivato · {reservation.customer_name}</button>
            <button className={`${btn} w-full`} disabled={busy} onClick={open}>Apri senza la prenotazione</button>
          </div>
        ) : <button className={`${btnPrimary} w-full !h-12`} disabled={busy} onClick={open}>{busy ? 'Apertura…' : 'Apri tavolo'}</button>
      }>
      {reservation && (
        <div className="mb-2 p-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5">
          <p className="text-xs text-[var(--text-muted)]">Prenotato</p>
          <p className="text-sm font-semibold text-[var(--text-main)]">{reservation.start_time} · {reservation.customer_name} · {reservation.party_size} {reservation.party_size === 1 ? 'persona' : 'persone'}</p>
          {reservation.notes && <p className="text-xs text-[var(--text-muted)] mt-0.5">{reservation.notes}</p>}
        </div>
      )}
      <CoversStepper value={covers} onChange={setCovers} />
    </PanelFrame>
  );
};

export default OpenTablePanel;
