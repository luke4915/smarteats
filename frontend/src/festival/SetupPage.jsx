import { PageBody } from '../components/shared/PageHeader';
import AppearanceSettings from '../components/setup/AppearanceSettings';
import OrderSettings from '../components/setup/OrderSettings';
import PrintProfiles from '../components/setup/PrintProfiles';
import MenuSettings from '../components/setup/MenuSettings';
import UsersSettings from '../components/setup/UsersSettings';
import AccountSettings from '../components/shared/AccountSettings';
import FeedbackBox from '../components/shared/FeedbackBox';
import TakeawaySettings from '../smarteats/takeaway/TakeawaySettings';

// Le impostazioni della cassa: un elenco di sezioni, ognuna visibile secondo il ruolo.
const SetupPage = ({ user, theme, setTheme, isSoundEnabled, setIsSoundEnabled, orderMode, setOrderMode }) => (
  <PageBody>
    <AppearanceSettings theme={theme} setTheme={setTheme} isSoundEnabled={isSoundEnabled} setIsSoundEnabled={setIsSoundEnabled} />
    {user.role === 'admin' && user.modules?.includes('takeaway') && <TakeawaySettings />}
    {user.role !== 'kitchen' && <><MenuSettings /><OrderSettings orderMode={orderMode} setOrderMode={setOrderMode} /><PrintProfiles /></>}
    {user.role === 'admin' && <UsersSettings />}
    <FeedbackBox modules={['pos', 'kitchen', 'catalog', 'stats', 'settings']} />
    <AccountSettings />
  </PageBody>
);

export default SetupPage;
