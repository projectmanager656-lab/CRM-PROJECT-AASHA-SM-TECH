import { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import AdminLayout from '../../../AdminDashboard/components/AdminLayout';
import '../components/ResourceModule.css';

const fields = [['firstName', 'First Name'], ['lastName', 'Last Name'], ['phone', 'Phone'], ['designation', 'Designation'], ['department', 'Department'], ['location', 'Location'], ['emergencyContact', 'Emergency Contact']];

export default function Profile() {
  const { user, updateCurrentUser } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();
  const editing = location.pathname.endsWith('/edit');
  const isAdmin = user?.role === 'admin';
  const Layout = isAdmin ? AdminLayout : UserLayout;
  const profilePath = isAdmin ? '/admin/profile' : '/user/profile';
  const [profile, setProfile] = useState(user || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The app context is populated from the registration/login response and is the
  // same authenticated user record used by the dashboard sidebar.
  useEffect(() => {
    setProfile(user || {});
  }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.patch('/profile', profile);
      const updatedUser = response.data.data;
      setProfile(updatedUser);
      updateCurrentUser(updatedUser);
      setSuccess('Profile updated');
      navigate(profilePath);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  return <Layout pageTitle="My Profile"><section className="resource-module"><div className="resource-toolbar"><div><span className="page-kicker">{isAdmin ? 'Admin Account' : 'Employee Account'}</span><h2>{editing ? 'Edit Profile' : 'Profile'}</h2></div><div className="resource-actions">{editing ? <button className="ghost-btn" onClick={() => navigate(profilePath)}>Cancel</button> : <button className="primary-btn" onClick={() => navigate(`${profilePath}/edit`)}>Edit Profile</button>}</div></div>{error && <div className="resource-message error">{error}</div>}{success && <div className="resource-message success">{success}</div>}{editing ? <form className="resource-form" onSubmit={submit}>{fields.map(([key, label]) => <label key={key}><span>{label}{['firstName', 'lastName'].includes(key) ? ' *' : ''}</span><input required={['firstName', 'lastName'].includes(key)} value={profile[key] || ''} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}<div className="resource-form-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button></div></form> : <div className="resource-details"><div><span>Name</span><strong>{profile.firstName} {profile.lastName}</strong></div><div><span>Email</span><strong>{profile.email}</strong></div>{fields.slice(2).map(([key, label]) => <div key={key}><span>{label}</span><strong>{profile[key] || '-'}</strong></div>)}</div>}</section></Layout>;
}
