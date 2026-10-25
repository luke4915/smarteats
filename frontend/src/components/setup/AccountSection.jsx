import AccountSettings from '../shared/AccountSettings';
import UsersSettings from './UsersSettings';

// La sezione «Account» delle Impostazioni (SmartEats e sagre), per admin e responsabile: il proprio profilo e gli utenti del
// locale (solo l'admin: sono le sue password temporanee da dare a chi le dimentica).
const AccountSection = ({ user }) => (
  <>
    <AccountSettings />
    {user.role === 'admin' && <UsersSettings />}
  </>
);

export default AccountSection;
