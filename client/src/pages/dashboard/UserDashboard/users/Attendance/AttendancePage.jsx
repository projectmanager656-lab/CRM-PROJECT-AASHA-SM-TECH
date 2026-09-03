import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import AttendanceManagement from '../../../../../components/AttendanceManagement/AttendanceManagement';
import '../components/ResourceModule.css';

const hours = (m) => m == null ? '-' : `${Math.floor(m / 60)}h ${m % 60}m`;
const getLocation = () => new Promise((resolve, reject) => !navigator.geolocation ? resolve({}) : navigator.geolocation.getCurrentPosition((p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => reject(new Error('Location permission was denied.')), { enableHighAccuracy: true, timeout: 10000 }));

export default function AttendancePage() {
  const { user } = useContext(AppContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (user?.department === 'HR' && !id) {
    return <AttendanceManagement Layout={UserLayout} title="Attendance Management" />;
  }

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiClient.get(id ? `/attendance/${id}` : '/attendance', { params: id ? {} : { month } });
      id ? setDetail(r.data.data) : setItems(r.data.data || []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, month]);

  const punch = async (action, recordId) => {
    try {
      const payload = await getLocation();
      action === 'in' ? await apiClient.post('/attendance', payload) : await apiClient.patch(`/attendance/${recordId}/checkout`, payload);
      setSuccess(action === 'in' ? 'Punched in successfully.' : 'Punched out successfully.');
      load();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Unable to record attendance.');
    }
  };

  const active = items.find((x) => !x.checkOut);

  return (
    <UserLayout pageTitle="Attendance">
      <section className="resource-module">
        <div className="resource-toolbar">
          <div>
            <span className="page-kicker">Employee Records</span>
            <h2>{id ? 'Attendance Details' : 'Attendance History'}</h2>
          </div>
          <div className="resource-actions">
            {id ? (
              <button type="button" className="ghost-btn" onClick={() => navigate('/user/attendance')}>Back</button>
            ) : (
              <>
                <button type="button" className="primary-btn" onClick={() => punch('in')}>Punch In</button>
                {active && <button type="button" className="ghost-btn" onClick={() => punch('out', active._id)}>Punch Out</button>}
              </>
            )}
          </div>
        </div>
        {error && <div className="resource-message error">{error}</div>}
        {success && <div className="resource-message success">{success}</div>}
        {loading ? (
          <div className="resource-empty">Loading...</div>
        ) : id && detail ? (
          <div className="resource-details">
            {[
              ['Date', detail.date],
              ['Status', detail.status],
              ['Punch In', detail.checkIn && new Date(detail.checkIn).toLocaleString()],
              ['Punch Out', detail.checkOut && new Date(detail.checkOut).toLocaleString()],
              ['Total Working Hours', hours(detail.totalWorkingMinutes)],
              ['Required Working Hours', hours(detail.requiredWorkingMinutes)],
              ['Punch In IP', detail.checkInIp],
              ['Punch Out IP', detail.checkOutIp],
              ['Location', detail.checkInLocation?.status],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v || '-'}</strong>
              </div>
            ))}
            {!detail.checkOut && (
              <button type="button" className="primary-btn" onClick={() => punch('out', detail._id)}>Punch Out</button>
            )}
          </div>
        ) : (
          <>
            <input className="resource-search" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            {items.length ? (
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Punch In</th>
                      <th>Punch Out</th>
                      <th>Working Hours</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((x) => (
                      <tr key={x._id}>
                        <td>{x.date}</td>
                        <td>{x.status}</td>
                        <td>{new Date(x.checkIn).toLocaleTimeString()}</td>
                        <td>{x.checkOut ? new Date(x.checkOut).toLocaleTimeString() : '-'}</td>
                        <td>{hours(x.totalWorkingMinutes)}</td>
                        <td>
                          <button type="button" className="table-action" onClick={() => navigate(`/user/attendance/${x._id}`)}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="resource-empty">No attendance records for this month.</div>
            )}
          </>
        )}
      </section>
    </UserLayout>
  );
}
