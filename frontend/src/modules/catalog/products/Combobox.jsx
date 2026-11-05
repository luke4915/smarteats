import { useState, useEffect, useRef, useId } from 'react';
import { Plus, ChevronDown, Check } from 'lucide-react';
import { input } from '../../../components/shared/styles';

// Campo di testo con suggerimenti: si scrive liberamente (anche un valore nuovo) o si sceglie fra quelli esistenti. Si usa anche da
// tastiera (frecce, Invio, Esc) e il pulsante a destra apre l'elenco intero. L'elenco è lo stesso aspetto del menu «⋯» (ActionMenu).
const Combobox = ({ name, value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  const typed = (value || '').trim();
  const isExisting = options.some(o => o.toLowerCase() === typed.toLowerCase());
  // Se il valore è già una voce dell'elenco si mostrano tutte (serve a cambiarla), altrimenti solo quelle che contengono ciò che si scrive
  const matching = isExisting || !typed ? options : options.filter(o => o.toLowerCase().includes(typed.toLowerCase()));
  const canCreate = !!typed && !isExisting;
  const count = matching.length + (canCreate ? 1 : 0);

  // La voce selezionata da tastiera resta visibile anche se l'elenco scorre; l'elenco intero si vede anche nel campo della finestra
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollIntoView({ block: 'nearest' });
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const pick = (option) => { onChange(option); setOpen(false); setActive(-1); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (count) setActive(a => (e.key === 'ArrowDown' ? (a + 1) % count : (a - 1 + count) % count));
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();                       // Invio sceglie la voce, non invia il modulo
      if (active < matching.length) pick(matching[active]); else { setOpen(false); setActive(-1); }
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();                      // chiude l'elenco, non la finestra
      setOpen(false); setActive(-1);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const optionClass = (on) => `w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer ${on ? 'bg-[var(--bg-card-2)]' : 'hover:bg-[var(--bg-card-2)]'}`;

  return (
    <div className="relative" ref={wrapperRef}>
      <input name={name} type="text" autoComplete="off" placeholder={placeholder} value={value}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        className={`${input} pr-10`} />
      {options.length > 0 && (
        <button type="button" tabIndex={-1} aria-label="Mostra tutte le voci" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(o => !o)}
          className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && count > 0 && (
        <div ref={listRef} id={listId} role="listbox" className="motion-tab absolute z-20 left-0 right-0 top-full mt-2 p-1.5 max-h-56 overflow-y-auto no-scrollbar rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
          {matching.map((o, i) => {
            const selected = o.toLowerCase() === typed.toLowerCase();
            return (
              <button key={o} id={`${listId}-${i}`} type="button" role="option" aria-selected={selected} data-active={i === active}
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className={`${optionClass(i === active)} ${selected ? 'font-semibold text-[var(--text-main)]' : 'text-[var(--text-main)]'}`}>
                <span className="flex-1 min-w-0 truncate">{o}</span>
                {selected && <Check size={16} className="shrink-0 text-[var(--accent)]" />}
              </button>
            );
          })}
          {canCreate && (
            <button id={`${listId}-${matching.length}`} type="button" role="option" aria-selected={false} data-active={active === matching.length}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); setActive(-1); }}
              className={`${optionClass(active === matching.length)} text-[var(--accent)] font-medium ${matching.length ? 'mt-1 border-t border-[var(--border)] rounded-t-none' : ''}`}>
              <Plus size={16} className="shrink-0" /><span className="truncate">Nuovo: «{typed}»</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Combobox;
