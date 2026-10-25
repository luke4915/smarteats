import AccountSettings from '../shared/AccountSettings';
import FeedbackBox from '../shared/FeedbackBox';
import UsersSettings from './UsersSettings';

// La sezione «Account» delle Impostazioni (SmartEats e sagre), per admin e responsabile: il proprio profilo, gli utenti del
// locale (solo l'admin: sono le sue password temporanee da dare a chi le dimentica) e il modulo dei suggerimenti.
const AccountSection = ({ user, feedbackModules }) => (
  <>
    <AccountSettings />
    {user.role === 'admin' && <UsersSettings />}
    <FeedbackBox modules={feedbackModules} />
  </>
);

export default AccountSection;
