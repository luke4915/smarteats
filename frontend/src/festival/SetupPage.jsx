import SectionsPage from '../components/shell/SectionsPage';
import PrintProfiles from '../components/setup/PrintProfiles';
import MenuSettings from '../components/setup/MenuSettings';
import AccountSection from '../components/setup/AccountSection';
import TakeawaySettings from '../smarteats/takeaway/TakeawaySettings';
import DeviceSettings from './DeviceSettings';
import { festivalSections } from './sections';

// Le impostazioni della cassa: il menu di sezioni è lo stesso di SmartEats (`SectionsPage`), qui c'è solo cosa mostra ognuna.
const SetupPage = ({ user, ...device }) => {
  const content = {
    device: () => <DeviceSettings {...device} />,
    takeaway: () => <TakeawaySettings />,
    menu: () => <MenuSettings />,
    printing: () => <PrintProfiles />,
    account: () => <AccountSection user={user} feedbackModules={['pos', 'kitchen', 'catalog', 'stats', 'settings']} />,
  };
  return <SectionsPage title="Sistema" sections={festivalSections(user)} content={content} />;
};

export default SetupPage;
