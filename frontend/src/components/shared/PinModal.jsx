import { useState } from 'react';
import Modal from './Modal';
import ModalActions from './ModalActions';
import { input, btnPrimary, btnDanger, label } from './styles';
import { PIN_MIN, PIN_MAX, needsLongPin, pinFitsRole } from '../../utils/pinEntry';

// L'amministratore sceglie il PIN di un utente (da 4 a 6 cifre) o lo toglie. Il server rifiuta i PIN banali (1234, 1111…) e lo scrive già
// cifrato: dopo il salvataggio nessuno, nemmeno l'amministratore, può rivederlo. `onSave(pin)` e `onRemove()` sono asincrone.
const PinModal = ({ user, onSave, onRemove, onClose }) => {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const digits = (v) => v.replace(/\D/g, '').slice(0, PIN_MAX);
  const long = needsLongPin(user.role);
  const valid = pinFitsRole(pin, user.role) && pin === again;

  const run = async (action) => { setBusy(true); try { await action(); } finally { setBusy(false); } };

  return (
    <Modal title={`PIN di ${user.username}`} onClose={onClose} dismissOnBackdrop={false} onSubmit={(e) => { e.preventDefault(); if (valid) run(() => onSave(pin)); }}
      footer={(
        <ModalActions onCancel={onClose}
          start={user.has_pin ? <button type="button" className={btnDanger} disabled={busy} onClick={() => run(onRemove)}>Togli PIN</button> : null}
          note={pin && again && pin !== again ? 'I due PIN non coincidono' : null}>
          <button type="submit" className={btnPrimary} disabled={busy || !valid}>Salva PIN</button>
        </ModalActions>
      )}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">Con il PIN {user.username} sblocca lo schermo e può darsi il cambio con i colleghi sulla stessa cassa.{long ? ' Per amministratore e responsabile il PIN è sempre di 6 cifre.' : ''} {user.has_pin ? 'Ne ha già uno: salvandone un altro lo sostituisci.' : ''}</p>
        <label className="block"><span className={label}>Nuovo PIN ({long ? `${PIN_MAX} cifre` : `${PIN_MIN}-${PIN_MAX} cifre`})</span>
          <input className={`${input} mt-1 tracking-[0.4em] text-center`} type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={e => setPin(digits(e.target.value))} /></label>
        <label className="block"><span className={label}>Ripeti il PIN</span>
          <input className={`${input} mt-1 tracking-[0.4em] text-center`} type="password" inputMode="numeric" autoComplete="off" value={again} onChange={e => setAgain(digits(e.target.value))} /></label>
      </div>
    </Modal>
  );
};

export default PinModal;
