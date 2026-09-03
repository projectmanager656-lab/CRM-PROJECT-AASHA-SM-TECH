import { useState, useEffect } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import '../Employees/HREmployees.css';

export default function Training() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/departments')
      .catch(() => apiClient.get('/departments'))
      .then((res) => setDepartments(res.data?.data || []))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserLayout pageTitle="Training & Development">
      <div className="hr-emp-container">
        <div className="hr-emp-header">
          <div className="hr-emp-title-area">
            <h2>Training & Skill Development</h2>
            <p>Employee learning programs, onboarding courses, and skill assessments.</p>
          </div>
        </div>

        <div className="hr-emp-table-card">
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h4 style={{ margin: 0, color: '#1e293b' }}>Department Training Tracks</h4>
            <small style={{ color: '#64748b' }}>Connected to registered company departments.</small>
          </div>
          {loading ? (
            <div className="hr-emp-empty">Loading training tracks...</div>
          ) : (
            <div className="hr-emp-table-wrap">
              <table className="hr-emp-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Headcount</th>
                    <th>Standard Training Module</th>
                    <th>Program Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d._id || d.name}>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.employeeCount !== undefined ? `${d.employeeCount} Enrolled` : 'Enrolled'}</td>
                      <td>{d.name} Standard Onboarding & Compliance</td>
                      <td>
                        <span className="hr-emp-status-badge active">
                          <span className="hr-emp-status-dot" />
                          Active Program
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
