import AdminLayout from '../components/AdminLayout';
import AttendanceManagement from '../../../../components/AttendanceManagement/AttendanceManagement';

export default function Attendance({ Layout = AdminLayout }) {
  return <AttendanceManagement Layout={Layout} title="Attendance Management" />;
}
