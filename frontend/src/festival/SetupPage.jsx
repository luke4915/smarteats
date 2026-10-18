import SectionsPage from '../components/shell/SectionsPage';
import PrintProfiles from '../components/setup/PrintProfiles';
import MenuSettings from '../components/setup/MenuSettings';
import UsersSettings from '../components/setup/UsersSettings';
import AccountSettings from '../components/shared/AccountSettings';
import FeedbackBox from '../components/shared/FeedbackBox';
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
    staff: () => <UsersSettings />,
    account: () => <><AccountSettings /><FeedbackBox modules={['pos', 'kitchen', 'catalog', 'stats', 'settings']} /></>,
  };
  return <SectionsPage title="Sistema" sections={festivalSections(user)} content={content} />;
};

export default SetupPage;
