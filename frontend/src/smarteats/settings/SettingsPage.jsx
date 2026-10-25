import AccountSection from '../../components/setup/AccountSection';
import FeedbackBox from '../../components/shared/FeedbackBox';
import RoomsSettings from '../../components/setup/RoomsSettings';
import SectionsPage from '../../components/shell/SectionsPage';
import CoverSettings from './CoverSettings';
import CourseSettings from './CourseSettings';
import BookingSettings from '../reservations/BookingSettings';
import NotificationSettings from '../notifications/NotificationSettings';
import TakeawaySettings from '../takeaway/TakeawaySettings';
import { settingsSections } from './sections';

// Cosa mostra ogni sezione. Le sezioni disponibili (per ruolo e moduli) le decide `sections.js`.
const content = (user) => ({
  service: () => <><CoverSettings /><CourseSettings /></>,
  rooms: () => <RoomsSettings />,
  bookings: () => <BookingSettings />,
  takeaway: () => <TakeawaySettings />,
  notifications: () => <NotificationSettings />,
  feedback: () => <FeedbackBox />,
  account: () => <AccountSection user={user} />,
});

// Impostazioni di SmartEats: le tile delle sezioni e la sezione scelta sono in `SectionsPage`, condivisa con la cassa delle sagre.
const SettingsPage = ({ user }) => <SectionsPage sections={settingsSections(user)} content={content(user)} />;

export default SettingsPage;
