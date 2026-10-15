import { PageHeader, PageBody } from '../../components/shared/PageHeader';
import AccountSettings from '../../components/shared/AccountSettings';
import RoomsSettings from '../../components/setup/RoomsSettings';
import UsersSettings from '../../components/setup/UsersSettings';
import CoverSettings from './CoverSettings';
import CourseSettings from './CourseSettings';
import BookingSettings from '../reservations/BookingSettings';
import NotificationSettings from '../notifications/NotificationSettings';
import TakeawaySettings from '../takeaway/TakeawaySettings';
import FeedbackBox from '../../components/shared/FeedbackBox';

// Impostazioni: l'admin configura il locale (coperto, portate, sale, prenotazioni, personale); ogni ruolo trova in
// fondo il proprio account e le notifiche del dispositivo.
const SettingsPage = ({ user }) => {
  const admin = user.role === 'admin';
  const has = (module) => user.modules?.includes(module);
  return (
    <PageBody>
      <PageHeader title="Impostazioni" subtitle={admin ? 'Come lavora il locale: coperto, portate, sale, prenotazioni e personale.' : 'Il tuo account e le notifiche di questo dispositivo.'} />
      {admin && has('tables') && <><CoverSettings /><CourseSettings /><RoomsSettings /></>}
      {admin && has('bookings') && <BookingSettings />}
      {admin && has('takeaway') && <TakeawaySettings />}
      {admin && <UsersSettings />}
      {(has('bookings') || has('takeaway')) && user.role !== 'kitchen' && <NotificationSettings />}
      <FeedbackBox />
      <AccountSettings />
    </PageBody>
  );
};

export default SettingsPage;
