import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import CenteredScreen from './CenteredScreen';
import PinPad from '../shared/PinPad';
import { useAuth } from '../../context/useAuth';
import { useLock } from '../../context/useLock';
import { fetchWithAuth, NetworkError } from '../../utils/apiClient';
import { makeVerifier, saveVerifier, checkOffline } from '../../offline/pinVerifier';
import { failureText } from '../../utils/pinEntry';
import { roleLabel } from '../shared/roles';
import { input, btnPrimary } from '../shared/styles';

// La schermata di blocco, sopra l'app (che resta in funzione sotto). Si sblocca con il PIN (anche senza rete, se il dispositivo lo
// conosce già) o con la password; «Cambia utente» fa entrare un collega di cassa, sala o cucina con il suo PIN, sullo stesso dispositivo.
const NO_NETWORK = 'Senza rete serve il PIN già usato su questo dispositivo: collegati a internet o riprova.';
const Avatar = ({ name }) => (
  <span className="mx-auto w-16 h-16 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-2xl font-semibold flex items-center justify-center select-none">{name.slice(0, 2).toUpperCase()}</span>
);
// Su schermi bassi (telefono in orizzontale, `[@media(max-height:480px)]:`) chi sei sta a sinistra e il tastierino a destra, così tutto sta nello schermo.
// Le classi vanno scritte per intero: Tailwind non ricava i nomi da stringhe composte.
const Split = ({ children }) => <div className={`grid gap-6 [@media(max-height:480px)]:grid-cols-2 [@media(max-height:480px)]:items-center`}>{children}</div>;
const link = 'text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer';

const LockScreen = () => {
  const { user, login, logout } = useAuth();
  const { unlock } = useLock();
  const [mode, setMode] = useState('pin');            // pin | password | people | switch
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState(null);
  const [target, setTarget] = useState(null);

  const go = (next) => { setMode(next); setError(''); setPassword(''); };

  // Il PIN può essere stato cambiato (o allungato) da un altro dispositivo: si riallinea la lunghezza mostrata
  useEffect(() => {
    fetchWithAuth('/auth/me').then(me => { if (me.pinLength !== user.pinLength || me.hasPin !== user.hasPin || me.pinSetAt !== user.pinSetAt) login({ ...user, hasPin: me.hasPin, pinLength: me.pinLength, pinSetAt: me.pinSetAt }); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta, all'apertura della schermata
  }, []);

  // Chi si può scegliere nel cambio utente: carico l'elenco solo quando serve
  useEffect(() => {
    if (mode !== 'people') return undefined;
    let alive = true;
    fetchWithAuth('/pin/operators').then(list => alive && setPeople(list.filter(p => p.id !== user.id)))
      .catch(err => alive && (setPeople([]), setError(err instanceof NetworkError ? 'Serve la rete per cambiare utente.' : err.message)));
    return () => { alive = false; };
  }, [mode, user.id]);

  const learnPin = async (userId, pin, pinSetAt) => saveVerifier(userId, await makeVerifier(pin), pinSetAt);

  const unlockWithPin = async (pin) => {
    setError('');
    try {
      const { pinSetAt } = await fetchWithAuth('/pin/unlock', { method: 'POST', body: { pin } });
      await learnPin(user.id, pin, pinSetAt);
      unlock();
    } catch (err) {
      if (!(err instanceof NetworkError)) return setError(err.message);
      const check = await checkOffline(user.id, pin);
      if (check.result === 'ok') return unlock();
      setError(check.result === 'none' ? NO_NETWORK : failureText(check));
    }
  };

  const unlockWithPassword = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await fetchWithAuth('/pin/unlock', { method: 'POST', body: { password } }); unlock(); }
    catch (err) { setError(err instanceof NetworkError ? 'Senza rete lo sblocco è solo con il PIN.' : err.message); setPassword(''); }
    finally { setBusy(false); }
  };

  const switchTo = async (pin) => {
    setError('');
    try {
      const session = await fetchWithAuth('/pin/switch', { method: 'POST', body: { userId: target.id, pin } });
      await learnPin(session.id, pin, session.pinSetAt);
      unlock();
      login(session);
    } catch (err) { setError(err instanceof NetworkError ? 'Serve la rete per cambiare utente.' : err.message); }
  };

  return (
    <div className="fixed inset-0 z-[3000]" role="dialog" aria-modal="true" aria-label="Schermo bloccato">
      <CenteredScreen glow>
        <div className={`w-full max-w-sm [@media(max-height:480px)]:max-w-2xl space-y-6 text-center`}>
          {mode === 'switch' ? (
            <>
              <Split>
                <div className="space-y-4"><Avatar name={target.username} />
                  <div><h1 className="text-xl font-semibold text-[var(--text-main)]">{target.username}</h1><p className="text-sm text-[var(--text-muted)]">{roleLabel(target.role)} · inserisci il tuo PIN</p></div></div>
                <div className="space-y-5">
                  <PinPad onSubmit={switchTo} length={target.pin_length} submitLabel="Entra" error={error} />
                  <button type="button" className={link} onClick={() => go('people')}><ArrowLeft size={13} className="inline -mt-0.5 mr-1" />Scegli un altro utente</button>
                </div>
              </Split>
            </>
          ) : mode === 'people' ? (
            <>
              <h1 className="text-xl font-semibold text-[var(--text-main)]">Chi sei?</h1>
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              {!people ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : people.length === 0 && !error ? (
                <p className="text-sm text-[var(--text-muted)]">Nessun collega ha ancora un PIN. Lo imposta l'amministratore da Impostazioni → Utenti.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3">
                  {people.map(p => (
                    <li key={p.id}><button type="button" onClick={() => { setTarget(p); go('switch'); }}
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-2)] transition cursor-pointer space-y-2">
                      <Avatar name={p.username} /><span className="block text-sm font-medium text-[var(--text-main)] truncate">{p.username}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{roleLabel(p.role)}</span></button></li>
                  ))}
                </ul>
              )}
              <button type="button" className={link} onClick={() => go('pin')}><ArrowLeft size={13} className="inline -mt-0.5 mr-1" />Indietro</button>
            </>
          ) : (
            <>
              <Split>
              <div className="space-y-4"><Avatar name={user.username} />
                <div><h1 className="text-xl font-semibold text-[var(--text-main)]">{user.username}</h1><p className="text-sm text-[var(--text-muted)]">{roleLabel(user.role)} · {user.tenantName}</p></div></div>
              <div className="space-y-5">
              {mode === 'pin' ? (
                <PinPad onSubmit={unlockWithPin} length={user.pinLength} error={error} />
              ) : (
                <form onSubmit={unlockWithPassword} className="space-y-3 text-left">
                  <input type="password" autoFocus autoComplete="current-password" className={input} placeholder="Password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} />
                  <p role="alert" className="min-h-5 text-sm text-red-500 text-center">{error}</p>
                  <button type="submit" disabled={busy || !password} className={`${btnPrimary} w-full`}>Sblocca</button>
                </form>
              )}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                <button type="button" className={link} onClick={() => go(mode === 'pin' ? 'password' : 'pin')}>{mode === 'pin' ? 'Usa la password' : 'Usa il PIN'}</button>
                <button type="button" className={link} onClick={() => go('people')}>Cambia utente</button>
                <button type="button" className={link} onClick={logout}>Esci</button>
              </div>
              </div>
              </Split>
            </>
          )}
        </div>
      </CenteredScreen>
    </div>
  );
};

export default LockScreen;
