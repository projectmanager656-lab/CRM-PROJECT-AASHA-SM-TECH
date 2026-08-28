import SuperAdminLayout from '../components/SuperAdminLayout';
import CalendarScheduler from '../../shared/CalendarScheduler';

export default function Calendar() {
  return (
    <SuperAdminLayout pageTitle="Calendar">
      <CalendarScheduler isAdmin={true} />
    </SuperAdminLayout>
  );
}
