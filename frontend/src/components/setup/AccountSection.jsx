import { useMemo } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import UsersPanel from '../shared/UsersPanel';
import ProfileForm from '../shared/ProfileForm';
import UsersSettings from './UsersSettings';

// La sezione «Account» delle Impostazioni (SmartEats e sagre), per admin e responsabile. L'amministratore vede tutti gli utenti del
// locale, con il proprio profilo nella riga «Tu» (sono sue le password temporanee da dare a chi le dimentica). Il responsabile ha solo
// la propria riga: username e password.
const SelfOnly = () => {
  const { user } = useAuth();
  const api = useMemo(() => ({ list: async () => [{ id: user.id, username: user.username, role: user.role, has_password: true, must_change_password: false }] }), [user.id, user.username, user.role]);
  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <h2 className="text-base font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2"><UserRound size={15} /> Il mio account</h2>
      <UsersPanel api={api} currentUserId={user.id} canManage={false} renderProfile={(onSaved) => <ProfileForm onSaved={onSaved} />} />
    </div>
  );
};

const AccountSection = ({ user }) => (user.role === 'admin' ? <UsersSettings /> : <SelfOnly />);

export default AccountSection;
