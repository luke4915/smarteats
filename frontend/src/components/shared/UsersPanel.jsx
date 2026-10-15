import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Pencil, KeyRound } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { ROLE_OPTIONS, roleLabel } from './roles';
import TempPasswordField from './TempPasswordField';

// Elenco e gestione degli utenti di un locale: lo usano l'admin del locale (Impostazioni) e il master (pannello locale).
// `api` nasconde da dove arrivano i dati: { list, create, update, remove, resetPassword }.
// `currentUserId` (solo admin del locale) esclude il proprio utente: lo si gestisce da «Il mio account».
// Una riga = un utente e un solo pulsante, «Modifica»: dentro ci sono nome, ruolo, password temporanea ed eliminazione.
const input = 'w-full h-10 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]';
const label = 'block text-xs font-medium text-[var(--text-muted)] mb-1';
const btn = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] text-[var(--text-main)] text-sm font-medium hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const primary = 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const EMPTY_NEW = { username: '', role: 'cashier', password: '' };

const Chip = ({ tone = 'muted', children }) => (
  <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium ${tone === 'accent' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : tone === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'}`}>{children}</span>
);

const UsersPanel = ({ api, currentUserId = null }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_NEW);
  const [editing, setEditing] = useState(null);       // { id, username, role, password, askDelete }

  const load = useCallback(async () => {
    try { setUsers(await api.list()); setError(''); }
    catch (err) { setError(err.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  // Esegue un'azione, mostra l'esito e ricarica l'elenco.
  const run = async (action, okMessage, onDone) => {
    setBusy(true);
    try { await action(); showToast(okMessage, 'success'); onDone?.(); await load(); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const create = () => run(() => api.create(newUser),
    `Utente «${newUser.username}» creato: dovrà cambiare la password al primo accesso`,
    () => { setNewUser(EMPTY_NEW); setCreating(false); });

  // Un solo «Salva»: cambia nome e ruolo se serve e imposta la password temporanea se ne è stata scritta una
  const save = () => {
    const original = users.find(u => u.id === editing.id);
    const changes = {};
    if (editing.username.trim() !== original.username) changes.username = editing.username.trim();
    if (editing.role !== original.role) changes.role = editing.role;
    const password = editing.password;
    if (!Object.keys(changes).length && !password) return setEditing(null);
    return run(async () => {
      if (Object.keys(changes).length) await api.update(editing.id, changes);
      if (password) await api.resetPassword(editing.id, password);
    }, password ? 'Salvato: l\'utente dovrà cambiare la password al prossimo accesso' : 'Utente aggiornato', () => setEditing(null));
  };

  const remove = () => run(() => api.remove(editing.id), 'Utente eliminato', () => setEditing(null));

  if (!users) return <p className="text-sm text-[var(--text-muted)]">{error || 'Caricamento utenti…'}</p>;
  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-3">
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <ul className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] overflow-hidden">
        {users.map(u => {
          const isSelf = u.id === currentUserId;
          const isLastAdmin = u.role === 'admin' && adminCount === 1;
          const isEditing = editing?.id === u.id;
          return (
            <li key={u.id} className="bg-[var(--bg-card)]">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="w-9 h-9 shrink-0 rounded-full bg-[var(--bg-card-2)] text-[var(--text-main)] text-sm font-semibold flex items-center justify-center">{u.username[0].toUpperCase()}</span>
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-sm text-[var(--text-main)] truncate">{u.username}</span>
                  <Chip tone="accent">{roleLabel(u.role)}</Chip>
                  {isSelf && <Chip>Tu</Chip>}
                  {!u.has_password && <Chip tone="warn">senza password</Chip>}
                  {u.has_password && u.must_change_password && <Chip tone="warn">password temporanea</Chip>}
                </div>
                {!isSelf && !isEditing && (
                  <button className={btn} disabled={busy} onClick={() => setEditing({ id: u.id, username: u.username, role: u.role, password: '', askDelete: false })}><Pencil size={14} /> Modifica</button>
                )}
              </div>

              {isEditing && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--bg-card-2)] border-t border-[var(--border)]">
                  <div className="grid gap-3 sm:grid-cols-2 pt-3">
                    <label><span className={label}>Username</span>
                      <input className={input} maxLength={50} value={editing.username} onChange={e => setEditing(v => ({ ...v, username: e.target.value }))} /></label>
                    <label><span className={label}>Ruolo</span>
                      <select className={input} value={editing.role} disabled={isLastAdmin} title={isLastAdmin ? 'Deve restare almeno un amministratore' : undefined}
                        onChange={e => setEditing(v => ({ ...v, role: e.target.value }))}>
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select></label>
                  </div>
                  <label className="block"><span className={label}><KeyRound size={12} className="inline -mt-0.5 mr-1" />Nuova password temporanea (facoltativa, almeno 8 caratteri)</span>
                    <TempPasswordField className={input} value={editing.password} placeholder="Lascia vuoto per non cambiarla" onChange={password => setEditing(v => ({ ...v, password }))} /></label>

                  {editing.askDelete ? (
                    <div className="rounded-lg border border-red-500/40 p-3 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-[var(--text-main)] flex-1 min-w-[12rem]">Eliminare «{u.username}»? Perde subito l'accesso; gli ordini già registrati restano.</p>
                      <button className={btn} onClick={() => setEditing(v => ({ ...v, askDelete: false }))}>No</button>
                      <button className="inline-flex items-center h-9 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium cursor-pointer disabled:opacity-50" disabled={busy} onClick={remove}>Sì, elimina</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button className={primary} disabled={busy || !editing.username.trim() || (editing.password !== '' && editing.password.length < 8)} onClick={save}>Salva</button>
                      <button className={btn} onClick={() => setEditing(null)}>Annulla</button>
                      <span className="flex-1" />
                      <button className="text-sm text-red-500 hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed" disabled={isLastAdmin}
                        title={isLastAdmin ? 'Deve restare almeno un amministratore' : undefined} onClick={() => setEditing(v => ({ ...v, askDelete: true }))}>Elimina utente</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {creating ? (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card-2)] space-y-3">
          <p className="text-sm font-medium text-[var(--text-main)]">Nuovo utente</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr]">
            <label><span className={label}>Username</span><input className={input} maxLength={50} value={newUser.username} onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))} /></label>
            <label><span className={label}>Password temporanea</span><TempPasswordField className={input} value={newUser.password} onChange={password => setNewUser(v => ({ ...v, password }))} /></label>
            <label><span className={label}>Ruolo</span>
              <select className={input} value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Scrivila o generala, poi comunicala all'utente: al primo accesso dovrà sceglierne una sua.</p>
          <div className="flex gap-2">
            <button className={primary} disabled={busy || !newUser.username.trim() || newUser.password.length < 8} onClick={create}>Crea utente</button>
            <button className={btn} onClick={() => { setCreating(false); setNewUser(EMPTY_NEW); }}>Annulla</button>
          </div>
        </div>
      ) : (
        <button className={btn} onClick={() => setCreating(true)}><UserPlus size={14} /> Nuovo utente</button>
      )}
    </div>
  );
};

export default UsersPanel;
