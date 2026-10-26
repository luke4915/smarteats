import { useState } from 'react';
import Modal from './Modal';
import ModalActions from './ModalActions';
import { btnPrimary, label } from '../../smarteats/floor/ui';
import { formatEuro } from '../../utils/format';

// Conferma della chiusura serata o servizio. Se ci sono ordini ancora aperti (in attesa o in preparazione) chi chiude
// sceglie: completarli (entrano nei conti) o lasciarli fuori da totale atteso e statistiche.
const EndSessionModal = ({ title, sessionName, openOrders, openOrdersTotal, onCancel, onConfirm }) => {
  const [choice, setChoice] = useState(null);
  const needsChoice = openOrders > 0;

  const option = (value, name, hint) => (
    <button onClick={() => setChoice(value)} aria-pressed={choice === value}
      className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${choice === value ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] hover:bg-[var(--bg-card-2)]'}`}>
      <span className="block font-medium text-sm text-[var(--text-main)]">{name}</span>
      <span className="block text-xs text-[var(--text-muted)]">{hint}</span>
    </button>
  );

  return (
    <Modal title={title} onClose={onCancel}
      footer={(
        <ModalActions fill onCancel={onCancel}>
          <button type="button" onClick={() => onConfirm(needsChoice ? choice : undefined)} disabled={needsChoice && !choice} className={btnPrimary}>Conferma</button>
        </ModalActions>
      )}>
      <p className="text-sm text-[var(--text-muted)]">Stai per chiudere <span className="font-semibold text-[var(--text-main)]">«{sessionName}»</span>.</p>
      {needsChoice && (
        <div className="space-y-2 mt-4">
          <p className={label}>Ci sono {openOrders} {openOrders === 1 ? 'ordine non completato' : 'ordini non completati'} ({formatEuro(openOrdersTotal)}). Cosa ne facciamo?</p>
          {option('complete', 'Completali', 'Entrano nel totale atteso e nelle statistiche.')}
          {option('leave', 'Lasciali fuori', 'Restano come sono, fuori da totale atteso e statistiche.')}
        </div>
      )}
    </Modal>
  );
};

export default EndSessionModal;
