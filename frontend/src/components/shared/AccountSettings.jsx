import { useState } from 'react';
import { Eye, EyeOff, Check, Circle, UserRound, KeyRound, Building2 } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import { fetchWithAuth } from '../../utils/apiClient';
import { roleLabel } from './roles';
import { btnPrimary, input, label } from '../../smarteats/floor/ui';

// Il profilo dell'utente collegato (nelle Impostazioni, sezione Account): username e password. Ogni parte si salva da
// sola, con i requisiti visibili mentre si scrive. Stile e componenti sono quelli delle altre schermate (floor/ui.js).
const MIN_PASSWORD = 8;

const Card = ({ icon, title, children }) => {
  const Icon = icon;
  return (
    <section className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)] mb-3"><Icon size={16} className="text-[var(--accent)]" /> {title}</h3>
      {children}
    </section>
  );
};

const Rule = ({ ok, children }) => (
  <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
    {ok ? <Check size={12} /> : <Circle size={10} />} {children}
  </li>
);

const PasswordInput = ({ label: text, value, onChange, show, autoComplete }) => (
  <label className="block">
    <span className={`${label} block mb-1`}>{text}</span>
    <input type={show ? 'text' : 'password'} autoComplete={autoComplete} className={input} value={value} onChange={e => onChange(e.target.value)} />
  </label>
);

const AccountSettings = () => {
  const { user, login } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState(user.username);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const trimmed = username.trim();
  const nameChanged = trimmed !== user.username;
  const longEnough = newPassword.length >= MIN_PASSWORD;
  const different = newPassword !== '' && newPassword !== oldPassword;
  const matches = newPassword !== '' && newPassword === confirmPassword;
  const canSavePassword = oldPassword !== '' && longEnough && different && matches;

  const saveUsername = async () => {
    setSavingName(true); setNameError('');
    try {
      const { username: saved } = await fetchWithAuth('/profile/username', { method: 'PATCH', body: { newUsername: trimmed } });
      login({ ...user, username: saved });
      setUsername(saved);
      showToast('Username aggiornato', 'success');
    } catch (err) {
      setNameError(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setSavingPassword(true); setPasswordError('');
    try {
      await fetchWithAuth('/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      showToast('Password aggiornata', 'success');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]" aria-label="Il mio profilo">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg bg-[var(--accent)] text-white text-xl font-semibold flex items-center justify-center shrink-0">
          {user.username[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text-main)]">Il mio profilo</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium">{roleLabel(user.role)}</span>
            {user.tenantName && <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] truncate"><Building2 size={12} /> {user.tenantName}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <Card icon={UserRound} title="Username">
          <input className={input} aria-label="Username" maxLength={50} autoComplete="username" value={username}
            onChange={e => { setUsername(e.target.value); setNameError(''); }}
            onKeyDown={e => e.key === 'Enter' && nameChanged && trimmed && saveUsername()} />
          {nameError && <p className="text-red-500 text-sm mt-2">{nameError}</p>}
          <button className={`${btnPrimary} mt-3`} disabled={!nameChanged || !trimmed || savingName} onClick={saveUsername}>
            {savingName ? 'Salvataggio…' : 'Salva username'}
          </button>
        </Card>

        <Card icon={KeyRound} title="Password">
          <div className="space-y-3">
            <PasswordInput label="Password attuale" value={oldPassword} onChange={v => { setOldPassword(v); setPasswordError(''); }} show={showPasswords} autoComplete="current-password" />
            <PasswordInput label="Nuova password" value={newPassword} onChange={setNewPassword} show={showPasswords} autoComplete="new-password" />
            <PasswordInput label="Ripeti la nuova password" value={confirmPassword} onChange={setConfirmPassword} show={showPasswords} autoComplete="new-password" />
          </div>
          <button type="button" onClick={() => setShowPasswords(v => !v)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
            {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />} {showPasswords ? 'Nascondi le password' : 'Mostra le password'}
          </button>
          <ul className="mt-3 space-y-1">
            <Rule ok={longEnough}>Almeno {MIN_PASSWORD} caratteri</Rule>
            <Rule ok={different}>Diversa da quella attuale</Rule>
            <Rule ok={matches}>Le due nuove password coincidono</Rule>
          </ul>
          {passwordError && <p className="text-red-500 text-sm mt-3">{passwordError}</p>}
          <button className={`${btnPrimary} mt-3`} disabled={!canSavePassword || savingPassword} onClick={savePassword}>
            {savingPassword ? 'Salvataggio…' : 'Cambia password'}
          </button>
        </Card>
      </div>
    </section>
  );
};

export default AccountSettings;
