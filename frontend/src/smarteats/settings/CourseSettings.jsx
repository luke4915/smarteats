import { useState, useEffect, useCallback } from 'react';
import { GripVertical, Trash2, Plus, CornerDownRight } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import SortableList from '../../components/shared/SortableList';
import { btn, iconBtn, input } from '../floor/ui';

// Le portate del locale nell'ordine in cui di solito escono. Si riordinano trascinando. Una portata può uscire
// «insieme alla precedente» (secondi e contorni): in comanda ha già lo stesso numero d'uscita, e il cameriere può
// sempre cambiarlo per quel tavolo.
const CourseSettings = () => {
  const { showToast } = useToast();
  const [courses, setCourses] = useState(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);     // { id, name }

  const load = useCallback(() => fetchWithAuth('/courses').then(setCourses).catch(err => showToast(err.message, 'error')), [showToast]);
  useEffect(() => { load(); }, [load]);

  const run = async (action) => { try { await action(); await load(); } catch (err) { showToast(err.message, 'error'); } };
  const add = () => run(async () => { await fetchWithAuth('/courses', { method: 'POST', body: { name } }); setName(''); });
  const rename = () => run(async () => { await fetchWithAuth(`/courses/${editing.id}`, { method: 'PUT', body: { name: editing.name } }); setEditing(null); });
  const remove = (c) => run(() => fetchWithAuth(`/courses/${c.id}`, { method: 'DELETE' }));
  const together = (c) => run(() => fetchWithAuth(`/courses/${c.id}`, { method: 'PUT', body: { with_previous: !c.with_previous } }));
  const reorder = (next) => { setCourses(next); run(() => fetchWithAuth('/courses/order', { method: 'PUT', body: { ids: next.map(c => c.id) } })); };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <h2 className="text-base font-semibold text-[var(--text-main)] mb-1">Portate</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">Trascina per metterle nell&apos;ordine in cui escono. Segna «insieme alla precedente» quelle che escono insieme, come secondi e contorni.</p>
      {courses === null ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <div className="max-w-xl mb-3">
          {courses.length === 0 && <p className="px-3 py-3 text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">Nessuna portata. Aggiungine una, per esempio «Antipasti».</p>}
          <SortableList items={courses} getId={c => c.id} onReorder={reorder} className="list-none"
            renderItem={(c, { handleProps, isDragging, index }) => (
              <div className={`flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg border bg-[var(--bg-card-2)] ${isDragging ? 'border-[var(--accent)] shadow-lg' : 'border-[var(--border)]'}`}>
                <span {...handleProps} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"><GripVertical size={18} /></span>
                {c.with_previous && index > 0 && <CornerDownRight size={16} className="text-[var(--accent)] shrink-0" aria-hidden="true" />}
                {editing?.id === c.id
                  ? <input className={`${input} !h-9 flex-1`} autoFocus maxLength={40} value={editing.name} aria-label="Nome della portata"
                      onChange={e => setEditing({ id: c.id, name: e.target.value })} onBlur={rename} onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null); }} />
                  : <button className="flex-1 min-w-0 text-left text-base text-[var(--text-main)] py-1.5 truncate" onClick={() => setEditing({ id: c.id, name: c.name })} title="Rinomina">{c.name}</button>}
                {index > 0 && (
                  <button role="switch" aria-checked={c.with_previous} onClick={() => together(c)} title={`Esce insieme a «${courses[index - 1].name}»`}
                    className={`shrink-0 h-8 coarse:h-10 px-3 rounded-full text-sm font-medium border transition ${c.with_previous ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    <span className="sm:hidden">{c.with_previous ? 'Insieme' : 'Dopo'}</span>
                    <span className="hidden sm:inline">{c.with_previous ? 'Insieme alla precedente' : 'Dopo la precedente'}</span>
                  </button>
                )}
                <button className={`${iconBtn} hover:!text-red-500`} aria-label={`Elimina ${c.name}`} onClick={() => remove(c)}><Trash2 size={16} /></button>
              </div>
            )} />
        </div>
      )}
      <div className="flex gap-2 max-w-xl">
        <input className={input} placeholder="Nuova portata" aria-label="Nuova portata" maxLength={40} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && add()} />
        <button className={btn} disabled={!name.trim()} onClick={add}><Plus size={16} /> Aggiungi</button>
      </div>
    </div>
  );
};

export default CourseSettings;
