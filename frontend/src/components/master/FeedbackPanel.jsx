import { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { btn } from '../../smarteats/floor/ui';

// I suggerimenti che i locali lasciano dalle Impostazioni: un elenco da aprire, con «Letto» per toglierli dai nuovi.
const FeedbackPanel = ({ feedback, onMark }) => {
  const [open, setOpen] = useState(false);
  const fresh = feedback.filter(f => f.status === 'new').length;
  return (
    <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
      <button className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <MessageSquare size={16} className="text-[var(--accent)]" />
        <span className="text-sm font-medium text-[var(--text-main)] flex-1">Feedback dai locali</span>
        {fresh > 0 && <span className="px-2 h-5 rounded-full bg-[var(--accent)] text-white text-xs font-semibold flex items-center tabular-nums">{fresh} nuovi</span>}
        <span className="text-xs text-[var(--text-muted)]">{open ? 'Chiudi' : 'Apri'}</span>
      </button>
      {open && (
        <ul className="border-t border-[var(--border)] divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
          {feedback.length === 0 && <li className="px-4 py-6 text-sm text-center text-[var(--text-muted)]">Nessun feedback per ora.</li>}
          {feedback.map(f => (
            <li key={f.id} className={`px-4 py-3 flex gap-3 ${f.status === 'read' ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{f.message}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{f.tenant_name} · {f.username} · {f.module} · {new Date(f.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button className={`${btn} !h-9`} onClick={() => onMark(f, f.status === 'new' ? 'read' : 'new')}>{f.status === 'new' ? <><Check size={14} /> Letto</> : 'Da rileggere'}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default FeedbackPanel;
