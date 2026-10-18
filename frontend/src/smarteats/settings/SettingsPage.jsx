import AccountSettings from '../../components/shared/AccountSettings';
import RoomsSettings from '../../components/setup/RoomsSettings';
import UsersSettings from '../../components/setup/UsersSettings';
import SectionsPage from '../../components/shell/SectionsPage';
import CoverSettings from './CoverSettings';
import CourseSettings from './CourseSettings';
import BookingSettings from '../reservations/BookingSettings';
import NotificationSettings from '../notifications/NotificationSettings';
import TakeawaySettings from '../takeaway/TakeawaySettings';
import FeedbackBox from '../../components/shared/FeedbackBox';
import { settingsSections } from './sections';

// Cosa mostra ogni sezione. Le sezioni disponibili (per ruolo e moduli) le decide `sections.js`.
const CONTENT = {
  service: () => <><CoverSettings /><CourseSettings /></>,
  rooms: () => <RoomsSettings />,
  bookings: () => <BookingSettings />,
  takeaway: () => <TakeawaySettings />,
  staff: () => <UsersSettings />,
  notifications: () => <NotificationSettings />,
  account: () => <><AccountSettings /><FeedbackBox /></>,
};

// Impostazioni di SmartEats: il menu di sezioni e la sezione scelta sono in `SectionsPage`, condivisa con la cassa delle sagre.
const SettingsPage = ({ user }) => <SectionsPage sections={settingsSections(user)} content={CONTENT} />;

export default SettingsPage;
