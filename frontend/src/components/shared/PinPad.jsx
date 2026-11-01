import { useState, useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';
import { pressKey, canSubmit, PIN_MAX } from '../../utils/pinEntry';

// Il tastierino del PIN, come quello di iOS: puntini che si riempiono, tasti grandi da dito (anche la tastiera del computer funziona).
// `length`: le cifre del PIN, se si conoscono: i puntini sono tanti quanti serve e all'ultima cifra si conferma da soli. Se la lunghezza è
// ignota (PIN impostati prima che la si registrasse) i puntini sono quattro e crescono, e si conferma con «Sblocca» da quattro cifre.
// `onSubmit(pin)` è asincrona: finché lavora i tasti sono fermi, e a risposta data (PIN sbagliato) le cifre si azzerano. `error` è il
// messaggio sotto i puntini.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const key = `w-16 h-16 coarse:w-[4.5rem] coarse:h-[4.5rem] [@media(max-height:480px)]:!w-11 [@media(max-height:480px)]:!h-11 [@media(max-height:480px)]:!text-lg rounded-full bg-[var(--bg-card-2)] text-[var(--text-main)] text-2xl font-medium tabular-nums hover:bg-[var(--border)] active:scale-95 active:bg-[var(--border)] transition disabled:opacity-40 cursor-pointer`;

const PinPad = ({ onSubmit, length = null, submitLabel = 'Sblocca', error = '', disabled = false }) => {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef({ pin, busy });
  live.current = { pin, busy };
  const off = disabled || busy;

  const dots = length ?? Math.max(4, pin.length);
  const add = (digit) => setPin(p => (length && p.length >= length ? p : pressKey(p, digit)));

  const submit = async () => {
    if (live.current.busy || !canSubmit(live.current.pin)) return;
    setBusy(true);
    try { await onSubmit(live.current.pin); } finally { setBusy(false); setPin(''); }
  };

  // Con la lunghezza nota, all'ultima cifra si conferma da soli
  useEffect(() => {
    if (length && pin.length === length) submit();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- parte solo quando cambiano le cifre
  }, [pin, length]);

  // Tastiera del computer: cifre, Backspace, Invio
  useEffect(() => {
    if (disabled) return undefined;
    const onKey = (e) => {
      if (live.current.busy || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) add(e.key);
      else if (e.key === 'Backspace') setPin(p => pressKey(p, 'back'));
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `submit` legge sempre i valori correnti da `live`
  }, [disabled]);

  return (
    <div className={`flex flex-col items-center gap-5 [@media(max-height:480px)]:gap-2`}>
      <div className="flex gap-3 h-4 items-center" role="img" aria-label={`${pin.length} cifre inserite`}>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full border transition ${i < pin.length ? 'bg-[var(--text-main)] border-[var(--text-main)]' : 'border-[var(--border-hover)]'}`} />
        ))}
      </div>
      <p role="alert" className={`min-h-10 [@media(max-height:480px)]:min-h-8 max-w-xs text-center text-sm text-red-500`}>{error}</p>
      <div className={`grid grid-cols-3 gap-x-5 gap-y-3 [@media(max-height:480px)]:gap-y-1.5 place-items-center`}>
        {KEYS.map(k => <button key={k} type="button" className={key} disabled={off} onClick={() => add(k)}>{k}</button>)}
        <span aria-hidden="true" />
        <button type="button" className={key} disabled={off} onClick={() => add('0')}>0</button>
        <button type="button" className={`${key} !bg-transparent`} disabled={off || !pin} aria-label="Cancella" onClick={() => setPin(p => pressKey(p, 'back'))}><Delete size={22} className="mx-auto" /></button>
      </div>
      {!length && <button type="button" disabled={off || !canSubmit(pin)} onClick={submit} aria-label={`${submitLabel} (da 4 a ${PIN_MAX} cifre)`}
        className={`w-full max-w-[17rem] h-12 [@media(max-height:480px)]:h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition disabled:opacity-40 cursor-pointer`}>{submitLabel}</button>}
    </div>
  );
};

export default PinPad;
