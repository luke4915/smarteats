import { useState } from 'react';
import { btnPrimary } from '../smarteats/floor/ui';
import { apiFetch } from '../utils/apiClient';
import { useToast } from '../context/useToast'; // Hook globale
import CenteredScreen from '../components/layout/CenteredScreen';

// Rimosso showToast dalle props, ora lo prendiamo dal Context
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 🛡️ Inizializziamo il toast globale
  const { showToast } = useToast();

  const handleLogin = async () => {
    if (!username.trim()) {
      showToast("Inserisci l'username", "error");
      return;
    }

    setLoading(true);
    try {
      // apiFetch e non fetchWithAuth: qui un 401 significa credenziali errate, non sessione scaduta.
      const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });

      // ✅ Login effettuato con successo
      showToast("Login effettuato!", "success");

      // Passiamo i dati al chiamante (App.jsx) che aggiornerà l'AuthContext
      // Tutto ciò che risponde il server (ruolo, tenant, tipo di attività, moduli…): niente elenco di campi da tenere allineato.
      onLogin(data);

    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredScreen glow>
      <form className="w-full max-w-sm flex flex-col items-center" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <div className="w-16 h-16 mb-5 bg-[var(--accent)] rounded-2xl flex items-center justify-center text-white font-semibold text-4xl select-none shadow-[0_14px_34px_-10px_color-mix(in_srgb,var(--accent)_70%,transparent)]" aria-hidden="true">S</div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-main)]">SmartEats</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 mb-8">Accedi per iniziare il servizio</p>

        <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] overflow-hidden">
          <input type="text" placeholder="Username" aria-label="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full h-12 px-4 bg-transparent text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus-visible:bg-[var(--bg-card-2)]" />
          <input type="password" placeholder="Password" aria-label="Password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 bg-transparent text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus-visible:bg-[var(--bg-card-2)]" />
        </div>
        <button type="submit" disabled={loading} className={`${btnPrimary} w-full !h-12 !text-base mt-4`}>
          {loading ? 'Accesso in corso…' : 'Login'}
        </button>
      </form>
    </CenteredScreen>
  );
};

export default Login;
