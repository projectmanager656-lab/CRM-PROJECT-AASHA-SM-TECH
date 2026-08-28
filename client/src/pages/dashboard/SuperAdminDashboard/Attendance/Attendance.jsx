import SuperAdminLayout from '../components/SuperAdminLayout';
import AttendanceManagement from '../../../../components/AttendanceManagement/AttendanceManagement';

export default function Attendance({ Layout = SuperAdminLayout }) {
  return <AttendanceManagement Layout={Layout} title="Attendance Management" />;
}
