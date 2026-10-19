import { useState } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import CoversStepper from '../floor/CoversStepper';
import { btnPrimary } from '../floor/ui';
import { seatsLabel } from '../floor/seats';
import { walkInTables, minutesNow, clockOf } from './timeline';

// Chi arriva senza prenotazione: si scelgono le persone, si vedono i tavoli liberi adesso (e per i prossimi 75 minuti,
// senza toccare una prenotazione in arrivo) dal più adatto, e un tocco apre il conto. `preferredTableId` arriva da un
// tocco su una cella libera della Timeline.
const WalkInPanel = ({ rooms, reservations, checks, preferredTableId = null, onBack, onSeated }) => {
  const { showToast } = useToast();
  const [party, setParty] = useState(2);
  const [chosen, setChosen] = useState(preferredTableId);
  const [busy, setBusy] = useState(false);
  const nowMin = minutesNow();
  const { fits, rest } = walkInTables(party, rooms, reservations, checks, { nowMin });
  const suggested = chosen && [...fits, ...rest].some(t => t.id === chosen) ? chosen : fits[0]?.id ?? null;

  const seat = async (tableId) => {
    setBusy(true);
    try { onSeated(await fetchWithAuth('/checks', { method: 'POST', body: { table_id: tableId, covers: party } })); }
    catch (err) {
      showToast(err.code === 'NO_ACTIVE_SESSION' ? 'Apri il servizio per far sedere qualcuno' : err.message, err.code === 'NO_ACTIVE_SESSION' ? 'warning' : 'error');
    } finally { setBusy(false); }
  };

  const option = (t, tone) => (
    <button key={t.id} onClick={() => setChosen(t.id)} aria-pressed={t.id === suggested} disabled={busy}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left cursor-pointer transition ${t.id === suggested ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[var(--bg-card-2)] hover:border-[var(--border-hover)]'}`}>
      <span className="text-sm font-medium text-[var(--text-main)]">{t.name} <span className="text-xs font-normal text-[var(--text-muted)]">· {t.roomName}</span></span>
      <span className={`text-xs tabular-nums ${tone}`}>{seatsLabel(t)} posti{t.under ? ' · più grande del necessario' : ''}</span>
    </button>
  );

  return (
    <PanelFrame title="Senza prenotazione" subtitle={`Adesso sono le ${clockOf(nowMin)}`} onBack={onBack}
      footer={<button className={`${btnPrimary} w-full !h-12`} disabled={busy || !suggested} onClick={() => seat(suggested)}>{busy ? 'Apertura…' : suggested ? `Fai sedere ${party} ${party === 1 ? 'persona' : 'persone'} al ${[...fits, ...rest].find(t => t.id === suggested).name}` : 'Nessun tavolo libero'}</button>}>
      <CoversStepper compact value={party} onChange={setParty} />
      <div className="mt-3 space-y-1.5">
        {fits.length > 0 && <p className="text-xs text-[var(--text-muted)] px-1">Liberi e adatti: tocca per scegliere un altro tavolo</p>}
        {fits.map(t => option(t, 'text-[var(--text-muted)]'))}
        {fits.length === 0 && rest.length > 0 && <p className="text-sm text-amber-500 px-1">Nessun tavolo libero ha {party} posti. Si può comunque sedere il gruppo e unire i tavoli dalla Sala.</p>}
        {fits.length === 0 && rest.length > 0 && rest.map(t => option(t, 'text-amber-500'))}
        {fits.length === 0 && rest.length === 0 && <p className="text-sm text-[var(--text-muted)] px-1">Tutti i tavoli sono occupati o prenotati a breve.</p>}
      </div>
    </PanelFrame>
  );
};

export default WalkInPanel;
