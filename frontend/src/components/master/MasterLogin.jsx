import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { btnPrimary, input } from '../../smarteats/floor/ui';
import CenteredScreen from '../layout/CenteredScreen';

// L'accesso alla console del gestore: una sola password.
const MasterLogin = ({ busy, error, onLogin }) => {
  const [password, setPassword] = useState('');
  return (
    <CenteredScreen>
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-6">
          <ShieldCheck size={36} className="text-[var(--accent)] mb-3" />
          <h1 className="text-xl font-semibold text-[var(--text-main)]">Console master</h1>
          <p className="text-sm text-[var(--text-muted)]">Area riservata al gestore</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(password); }} className="flex flex-col gap-3">
          <input type="password" placeholder="Password" aria-label="Password master" value={password}
            onChange={(e) => setPassword(e.target.value)} className={input} autoFocus />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Accesso…' : 'Entra'}</button>
        </form>
      </div>
    </CenteredScreen>
  );
};

export default MasterLogin;
