import SectionsPage from '../components/shell/SectionsPage';
import PrintProfiles from '../components/setup/PrintProfiles';
import MenuSettings from '../components/setup/MenuSettings';
import AccountSection from '../components/setup/AccountSection';
import FeedbackBox from '../components/shared/FeedbackBox';
import TakeawaySettings from '../smarteats/takeaway/TakeawaySettings';
import ReservedDataSettings from '../components/setup/ReservedDataSettings';
import InventorySettings from '../inventory/InventorySettings';
import DeviceSettings from './DeviceSettings';
import { festivalSections } from './sections';

// Le impostazioni della cassa: il menu di sezioni è lo stesso di SmartEats (`SectionsPage`), qui c'è solo cosa mostra ognuna.
const SetupPage = ({ user, ...device }) => {
  const content = {
    device: () => <DeviceSettings {...device} />,
    takeaway: () => <TakeawaySettings />,
    inventory: () => <InventorySettings />,
    menu: () => <MenuSettings />,
    printing: () => <PrintProfiles />,
    reserved: () => <ReservedDataSettings />,
    feedback: () => <FeedbackBox modules={['pos', 'kitchen', 'catalog', 'stats', 'settings']} />,
    account: () => <AccountSection user={user} />,
  };
  return <SectionsPage title="Sistema" sections={festivalSections(user)} content={content} />;
};

export default SetupPage;
