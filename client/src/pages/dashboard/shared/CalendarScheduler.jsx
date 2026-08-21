import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../services/apiClient';
import './CalendarScheduler.css';

const blank = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: '',
  type: 'Meeting',
  status: 'Scheduled',
  reminderMinutes: 0,
  assignedTo: '',
  participants: [],
};

const errorMessage = (error) =>
  error.response?.data?.message || (error.response ? 'Calendar request failed.' : 'Unable to connect to the server.');

const localValue = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');

const name = (user) => (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unassigned');

export default function CalendarScheduler({ isAdmin = false }) {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);

    if (view === 'day') {
      end.setDate(end.getDate() + 1);
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 7);
    } else {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 1);
    }

    return { start, end };
  }, [anchor, view]);

  const load = async () => {
    setLoading(true);
    try {
      const eventsResponse = await apiClient.get('/calendar', {
        params: { from: range.start.toISOString(), to: range.end.toISOString() },
      });
      setEvents(eventsResponse.data.data || []);
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);
    try {
      const usersResponse = await apiClient.get('/users');
      setUsers((usersResponse.data.data || []).filter((user) => user.role === 'employee'));
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
  }, [range.start.getTime(), range.end.getTime(), isAdmin]);

  const shift = (amount) => {
    const next = new Date(anchor);
    if (view === 'month') next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * (view === 'week' ? 7 : 1));
    setAnchor(next);
  };

  const startCreate = () => {
    setEditing(null);
    setForm({
      ...blank,
      startAt: localValue(new Date()),
      endAt: localValue(new Date(Date.now() + 3600000)),
    });
    setOpen(true);
  };

  const startEdit = (event) => {
    setEditing(event);
    setForm({
      ...blank,
      ...event,
      startAt: localValue(event.startAt),
      endAt: localValue(event.endAt),
      assignedTo: event.assignedTo?._id || event.assignedTo,
      participants: (event.participants || []).map((person) => person._id || person),
    });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        reminderMinutes: Number(form.reminderMinutes || 0),
      };

      if (editing) await apiClient.put(`/calendar/${editing._id}`, payload);
      else await apiClient.post('/calendar', payload);

      setOpen(false);
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (event) => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await apiClient.delete(`/calendar/${event._id}`);
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  const heading =
    view === 'day'
      ? anchor.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : view === 'week'
        ? `${range.start.toLocaleDateString()} - ${new Date(range.end - 1).toLocaleDateString()}`
        : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const employeePlaceholder = loadingUsers
    ? 'Loading employees...'
    : users.length
      ? 'Select employee'
      : 'No employees found';

  return (
    <section className="calendar-scheduler">
      <div className="calendar-toolbar">
        <div>
          <span className="page-kicker">{isAdmin ? 'Organisation schedule' : 'My schedule'}</span>
          <h2>Calendar</h2>
        </div>
        <div className="calendar-actions">
          <button type="button" className="ghost-btn" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button type="button" className="ghost-btn" onClick={() => shift(-1)}>
            ‹
          </button>
          <button type="button" className="ghost-btn" onClick={() => shift(1)}>
            ›
          </button>
          {isAdmin && (
            <button type="button" className="primary-btn" onClick={startCreate}>
              Add Schedule
            </button>
          )}
        </div>
      </div>

      <div className="calendar-controls admin-card">
        <strong>{heading}</strong>
        <select value={view} onChange={(event) => setView(event.target.value)}>
          <option value="month">Month</option>
          <option value="week">Week</option>
          <option value="day">Day</option>
        </select>
      </div>

      {error && <div className="resource-message error">{error}</div>}

      <div className="calendar-event-list admin-card">
        {loading ? (
          <div className="resource-empty">Loading events...</div>
        ) : events.length ? (
          events.map((event) => (
            <article className="calendar-event" key={event._id}>
              <div className="calendar-event-time">
                <strong>{new Date(event.startAt).toLocaleDateString()}</strong>
                <span>
                  {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="calendar-event-body">
                <h3>{event.title}</h3>
                <p>{event.description || event.location || 'No additional details.'}</p>
                <small>
                  {event.type} · Assigned to {name(event.assignedTo)}
                  {event.participants?.length ? ` · ${event.participants.length} participant(s)` : ''}
                </small>
              </div>
              {isAdmin && (
                <div className="calendar-event-actions">
                  <button type="button" className="action-btn edit" onClick={() => startEdit(event)}>
                    Edit
                  </button>
                  <button type="button" className="action-btn delete" onClick={() => remove(event)}>
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="resource-empty">No events scheduled for this {view}.</div>
        )}
      </div>

      {open && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal admin-card" onSubmit={submit}>
            <div className="admin-modal-header">
              <h3>{editing ? 'Edit Schedule' : 'Add Schedule'}</h3>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="admin-modal-grid">
              <label>
                <span>Title *</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>

              <label>
                <span>Event Type</span>
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  {['Meeting', 'Task', 'Reminder', 'Other'].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Start *</span>
                <input
                  required
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm({ ...form, startAt: event.target.value })}
                />
              </label>

              <label>
                <span>End *</span>
                <input
                  required
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                />
              </label>

              <label>
                <span>Assigned To *</span>
                <select
                  required
                  value={form.assignedTo}
                  onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
                  disabled={loadingUsers}
                >
                  <option value="">{employeePlaceholder}</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {name(user)} ({user.email})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Participants</span>
                <select
                  multiple
                  value={form.participants}
                  onChange={(event) =>
                    setForm({ ...form, participants: [...event.target.selectedOptions].map((option) => option.value) })
                  }
                  disabled={loadingUsers}
                >
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {name(user)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Location / Meeting Link</span>
                <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
              </label>

              <label>
                <span>Reminder (minutes)</span>
                <input
                  min="0"
                  type="number"
                  value={form.reminderMinutes}
                  onChange={(event) => setForm({ ...form, reminderMinutes: event.target.value })}
                />
              </label>

              <label className="calendar-description">
                <span>Description</span>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="primary-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
