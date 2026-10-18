import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { btn, iconBtn } from '../floor/ui';

// Il selettore del periodo (giorno o mese): freccine a sinistra e a destra, al centro il nome del periodo che, toccato,
// apre il calendario del dispositivo (`pickerType` = 'date' o 'month'). «Oggi» compare solo quando non si è già lì.
const PeriodNav = ({ label, hint, onPrev, onNext, prevLabel, nextLabel, isCurrent, onToday, todayLabel = 'Oggi', pickerType = 'date', pickerValue, onPick }) => {
  const input = useRef(null);
  const openPicker = () => { try { input.current?.showPicker(); } catch { input.current?.focus(); } };
  return (
    <div className="flex items-center gap-1">
      <button className={iconBtn} aria-label={prevLabel} onClick={onPrev}><ChevronLeft size={20} /></button>
      <div className="relative">
        <button onClick={openPicker} className="min-w-[10rem] px-2 py-0.5 rounded-lg text-center hover:bg-[var(--bg-card-2)] cursor-pointer transition-colors" aria-label={`${label}: scegli un'altra data`}>
          <span className="block text-lg font-semibold tracking-tight text-[var(--text-main)] first-letter:uppercase leading-tight">{label}</span>
          {hint && <span className="block text-xs text-[var(--text-muted)]">{hint}</span>}
        </button>
        <input ref={input} type={pickerType} tabIndex={-1} aria-hidden="true" value={pickerValue} onChange={(e) => e.target.value && onPick(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />
      </div>
      <button className={iconBtn} aria-label={nextLabel} onClick={onNext}><ChevronRight size={20} /></button>
      {!isCurrent && <button className={`${btn} !h-9 ml-1`} onClick={onToday}>{todayLabel}</button>}
    </div>
  );
};

export default PeriodNav;
