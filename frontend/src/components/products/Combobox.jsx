import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';

// Campo di testo con suggerimenti: si scrive liberamente (anche un valore nuovo) o si sceglie fra quelli esistenti.
const Combobox = ({ name, value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const matching = options.filter(o => o.toLowerCase().includes((value || '').toLowerCase()));
  const isExisting = options.some(o => o.toLowerCase() === (value || '').trim().toLowerCase());

  return (
    <div className="relative" ref={wrapperRef}>
      <input name={name} type="text" autoComplete="off" placeholder={placeholder} value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-main)] font-medium text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
      {open && (matching.length > 0 || (value?.trim() && !isExisting)) && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg no-scrollbar">
          {matching.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer">{o}</button>
          ))}
          {value?.trim() && !isExisting && (
            <button type="button" onClick={() => setOpen(false)}
              className="w-full text-left px-3 py-2 text-sm text-[var(--accent)] font-bold hover:bg-[var(--bg-card-2)] transition-colors border-t border-[var(--border)] cursor-pointer flex items-center gap-1.5">
              <Plus size={14} /> Crea nuovo: "{value}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Combobox;
