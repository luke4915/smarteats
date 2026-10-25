import { useState } from 'react';
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

  // Gestione invio con tasto Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <CenteredScreen>

      <div className="w-14 h-14 mb-4 bg-[var(--accent)] rounded-xl flex items-center justify-center text-white font-semibold text-3xl select-none" aria-hidden="true">S</div>
      <h1 className="text-2xl font-semibold mb-6 text-[var(--text-main)]">SmartEats</h1>

      <div className="flex flex-col gap-4 w-full max-w-80">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-semibold text-sm shadow-lg shadow-[var(--accent)]/30 transition-all ${loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
        >
          {loading ? "Accesso in corso..." : "Login"}
        </button>
      </div>
    </CenteredScreen>
  );
};

export default Login;