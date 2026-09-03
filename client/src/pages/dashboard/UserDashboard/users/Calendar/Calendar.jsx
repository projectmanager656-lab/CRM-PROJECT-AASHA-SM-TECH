import React, { useState, useEffect, useMemo, useContext } from 'react';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './Calendar.css';

const EVENT_TYPES = [
  'HR Meeting',
  'Employee Meeting',
  'Interview',
  'Company Event',
  'HR Event',
  'Workshop',
  'Training',
  'Payroll Deadline',
  'Leave / Holiday',
  'Other',
];

const INTERVIEW_ROUNDS = [
  'Screening Round',
  'Technical Round 1',
  'Technical Round 2',
  'Managerial Round',
  'HR Round',
  'Final Executive Round',
];

export default function HRCalendar() {
  const { user } = useContext(AppContext);

  // Data States
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Navigation & View States
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day' | 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showLeaves, setShowLeaves] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Conflict state
  const [conflictWarning, setConflictWarning] = useState(null);

  // Form Initial States
  const defaultEventForm = {
    title: '',
    type: 'HR Meeting',
    department: 'HR',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    assignedTo: user?._id || user?.id || '',
    participants: [],
    location: '',
    meetingLink: '',
    description: '',
    reminderMinutes: 30,
    status: 'Scheduled',
  };

  const defaultInterviewForm = {
    candidateId: '',
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    jobPosition: '',
    department: 'Tech',
    interviewRound: 'Technical Round 1',
    assignedTo: user?._id || user?.id || '',
    participants: [],
    interviewDate: new Date().toISOString().slice(0, 10),
    startTime: '11:00',
    endTime: '12:00',
    interviewType: 'Online Video',
    meetingLink: '',
    location: '',
    notes: '',
    reminderMinutes: 30,
    status: 'Scheduled',
  };

  const [eventForm, setEventForm] = useState(defaultEventForm);
  const [interviewForm, setInterviewForm] = useState(defaultInterviewForm);
  const [rescheduleData, setRescheduleData] = useState({ date: '', startTime: '', endTime: '', notes: '' });

  // Show auto-clearing feedback toast
  const showToast = (msg, type = 'success') => {
    setFeedback({ message: msg, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 4500);
  };

  // Fetch initial master data
  useEffect(() => {
    fetchMasterData();
  }, []);

  // Fetch calendar events whenever date or filters change
  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const fetchMasterData = async () => {
    try {
      const [usersRes, deptsRes, candRes, jobsRes, leavesRes] = await Promise.allSettled([
        apiClient.get('/users'),
        apiClient.get('/departments'),
        apiClient.get('/recruitment/candidates'),
        apiClient.get('/recruitment/jobs'),
        apiClient.get('/leave-requests'),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value.data?.data) {
        setEmployees(usersRes.value.data.data.filter((u) => u.role === 'employee' || u.role === 'user'));
      }
      if (deptsRes.status === 'fulfilled' && deptsRes.value.data?.data) {
        setDepartments(deptsRes.value.data.data);
      }
      if (candRes.status === 'fulfilled' && candRes.value.data?.data) {
        setCandidates(candRes.value.data.data);
      }
      if (jobsRes.status === 'fulfilled' && jobsRes.value.data?.data) {
        setJobs(jobsRes.value.data.data);
      }
      if (leavesRes.status === 'fulfilled' && leavesRes.value.data?.data) {
        const approved = (leavesRes.value.data.data || []).filter((l) => l.status === 'Approved');
        setApprovedLeaves(approved);
      }
    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Determine date range for current view
      let from, to;
      const d = new Date(currentDate);

      if (view === 'month') {
        from = new Date(d.getFullYear(), d.getMonth(), 1);
        to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      } else if (view === 'week') {
        const dayOfWeek = d.getDay();
        from = new Date(d);
        from.setDate(d.getDate() - dayOfWeek);
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setDate(from.getDate() + 7);
      } else {
        from = new Date(d);
        from.setHours(0, 0, 0, 0);
        to = new Date(d);
        to.setDate(d.getDate() + 1);
        to.setHours(0, 0, 0, 0);
      }

      const res = await apiClient.get('/calendar', {
        params: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });

      setEvents(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      showToast('Unable to load calendar events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Conflict Checking Engine
  const checkConflicts = async (startAt, endAt, userIds, excludeId = null) => {
    try {
      const res = await apiClient.post('/calendar/check-conflict', {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        userIds,
        excludeEventId: excludeId,
      });
      if (res.data.data?.hasConflict) {
        const conflictTitles = res.data.data.conflicts.map((c) => `"${c.title}" (${new Date(c.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`).join(', ');
        setConflictWarning(`Potential conflict: Selected attendees already have active events during this time: ${conflictTitles}`);
      } else {
        setConflictWarning(null);
      }
    } catch (e) {
      setConflictWarning(null);
    }
  };

  // Handle Date Navigation
  const handleNavigate = (direction) => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() + direction);
    } else if (view === 'week') {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setDate(next.getDate() + direction);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Convert Approved Leaves into virtual calendar display items
  const virtualLeaveEvents = useMemo(() => {
    if (!showLeaves || !approvedLeaves.length) return [];
    return approvedLeaves.map((l) => ({
      _id: `leave-${l._id}`,
      isLeave: true,
      title: `${l.user?.firstName || 'Employee'} — ${l.type} Leave`,
      startAt: l.startDate,
      endAt: l.endDate,
      type: 'Leave',
      status: 'Approved',
      department: l.user?.jobDetails?.department || l.user?.department || 'General',
      description: l.reason,
    }));
  }, [showLeaves, approvedLeaves]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const all = [...events, ...virtualLeaveEvents];
    return all.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const candMatch = item.candidateName?.toLowerCase().includes(q);
        const posMatch = item.jobPosition?.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        if (!titleMatch && !candMatch && !posMatch && !descMatch) return false;
      }
      // Type
      if (typeFilter !== 'All') {
        if (typeFilter === 'Leave / Holiday' && !item.type?.includes('Leave') && !item.type?.includes('Holiday')) return false;
        if (typeFilter !== 'Leave / Holiday' && item.type !== typeFilter) return false;
      }
      // Department
      if (deptFilter !== 'All' && item.department && item.department !== deptFilter) return false;
      // Status
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      return true;
    });
  }, [events, virtualLeaveEvents, search, typeFilter, deptFilter, statusFilter]);

  // Statistics KPI counts
  const stats = useMemo(() => {
    const totalMonth = events.length;
    const interviews = events.filter((e) => e.type === 'Interview').length;
    const hrMeetings = events.filter((e) => e.type === 'HR Meeting' || e.type === 'HR Event').length;
    const todayStr = new Date().toDateString();
    const todayCount = events.filter((e) => new Date(e.startAt).toDateString() === todayStr).length;

    return { totalMonth, interviews, hrMeetings, todayCount };
  }, [events]);

  // Create Standard HR Event
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const [sh, sm] = eventForm.startTime.split(':');
      const [eh, em] = eventForm.endTime.split(':');

      const startAt = new Date(eventForm.date);
      startAt.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

      const endAt = new Date(eventForm.date);
      endAt.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

      if (endAt <= startAt) {
        showToast('End time must be later than start time.', 'error');
        setActionLoading(false);
        return;
      }

      const payload = {
        title: eventForm.title,
        type: eventForm.type,
        department: eventForm.department,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        assignedTo: eventForm.assignedTo || user?._id || user?.id,
        participants: eventForm.participants,
        location: eventForm.location,
        meetingLink: eventForm.meetingLink,
        description: eventForm.description,
        reminderMinutes: parseInt(eventForm.reminderMinutes, 10) || 0,
        status: eventForm.status,
      };

      await apiClient.post('/calendar', payload);
      showToast('HR Event scheduled successfully.');
      setShowAddModal(false);
      setEventForm(defaultEventForm);
      setConflictWarning(null);
      fetchEvents();
    } catch (err) {
      console.error('Event creation failed:', err);
      showToast(err.response?.data?.message || 'Failed to create event.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Schedule Candidate Interview
  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const [sh, sm] = interviewForm.startTime.split(':');
      const [eh, em] = interviewForm.endTime.split(':');

      const startAt = new Date(interviewForm.interviewDate);
      startAt.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

      const endAt = new Date(interviewForm.interviewDate);
      endAt.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

      if (endAt <= startAt) {
        showToast('Interview end time must be later than start time.', 'error');
        setActionLoading(false);
        return;
      }

      const title = `Interview: ${interviewForm.candidateName || 'Candidate'} (${interviewForm.interviewRound})`;

      const payload = {
        title,
        type: 'Interview',
        candidate: interviewForm.candidateId || null,
        candidateName: interviewForm.candidateName,
        candidateEmail: interviewForm.candidateEmail,
        candidatePhone: interviewForm.candidatePhone,
        jobPosition: interviewForm.jobPosition,
        department: interviewForm.department,
        interviewRound: interviewForm.interviewRound,
        interviewType: interviewForm.interviewType,
        meetingLink: interviewForm.meetingLink,
        location: interviewForm.location,
        notes: interviewForm.notes,
        description: `Candidate: ${interviewForm.candidateName} (${interviewForm.candidateEmail})\nPosition: ${interviewForm.jobPosition}\nRound: ${interviewForm.interviewRound}\nNotes: ${interviewForm.notes}`,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        assignedTo: interviewForm.assignedTo || user?._id || user?.id,
        participants: interviewForm.participants,
        reminderMinutes: parseInt(interviewForm.reminderMinutes, 10) || 30,
        status: 'Scheduled',
      };

      await apiClient.post('/calendar', payload);
      showToast('Candidate interview scheduled & linked successfully.');
      setShowInterviewModal(false);
      setInterviewForm(defaultInterviewForm);
      setConflictWarning(null);
      fetchEvents();
    } catch (err) {
      console.error('Interview scheduling failed:', err);
      showToast(err.response?.data?.message || 'Failed to schedule interview.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Candidate Selector Auto-Fill
  const handleSelectCandidate = (candId) => {
    const cand = candidates.find((c) => c._id === candId);
    if (cand) {
      setInterviewForm((prev) => ({
        ...prev,
        candidateId: cand._id,
        candidateName: cand.name || '',
        candidateEmail: cand.email || '',
        candidatePhone: cand.phone || '',
        jobPosition: cand.appliedPosition || cand.position || prev.jobPosition,
        department: cand.department || prev.department,
      }));
    } else {
      setInterviewForm((prev) => ({
        ...prev,
        candidateId: '',
        candidateName: '',
        candidateEmail: '',
        candidatePhone: '',
      }));
    }
  };

  // Quick Reschedule Event
  const handleQuickReschedule = async (e) => {
    e.preventDefault();
    if (!selectedEvent || selectedEvent.isLeave) return;
    setActionLoading(true);
    try {
      const [sh, sm] = rescheduleData.startTime.split(':');
      const [eh, em] = rescheduleData.endTime.split(':');

      const startAt = new Date(rescheduleData.date);
      startAt.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

      const endAt = new Date(rescheduleData.date);
      endAt.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

      if (endAt <= startAt) {
        showToast('End time must be after start time.', 'error');
        setActionLoading(false);
        return;
      }

      await apiClient.put(`/calendar/${selectedEvent._id}`, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        status: 'Rescheduled',
        notes: rescheduleData.notes || selectedEvent.notes,
      });

      showToast('Event rescheduled successfully.');
      setShowRescheduleModal(false);
      setShowDetailsModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Reschedule failed:', err);
      showToast(err.response?.data?.message || 'Failed to reschedule event.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Event
  const handleCancelEvent = async () => {
    if (!selectedEvent || selectedEvent.isLeave) return;
    if (!window.confirm(`Are you sure you want to cancel "${selectedEvent.title}"?`)) return;
    setActionLoading(true);
    try {
      await apiClient.put(`/calendar/${selectedEvent._id}`, {
        status: 'Cancelled',
      });
      showToast('Event has been cancelled.');
      setShowDetailsModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Cancel event failed:', err);
      showToast(err.response?.data?.message || 'Failed to cancel event.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async () => {
    if (!selectedEvent || selectedEvent.isLeave) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${selectedEvent.title}" from the database?`)) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/calendar/${selectedEvent._id}`);
      showToast('Event permanently deleted.');
      setShowDetailsModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Delete event failed:', err);
      showToast(err.response?.data?.message || 'Failed to delete event.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Details Modal
  const openEventDetails = (event) => {
    setSelectedEvent(event);
    setShowDetailsModal(true);
  };

  // Open Quick Reschedule from Details
  const openRescheduleModal = () => {
    if (!selectedEvent) return;
    const start = new Date(selectedEvent.startAt);
    const end = new Date(selectedEvent.endAt);
    setRescheduleData({
      date: start.toISOString().slice(0, 10),
      startTime: start.toTimeString().slice(0, 5),
      endTime: end.toTimeString().slice(0, 5),
      notes: selectedEvent.notes || '',
    });
    setShowRescheduleModal(true);
  };

  // Month View Days Builder
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month overflow to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      const key = new Date(ev.startAt).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Pill styling helper
  const getPillClass = (type, isLeave) => {
    if (isLeave) return 'hr-pill-leave';
    const clean = String(type || '').toLowerCase().replace(/[^a-z]/g, '');
    return `hr-pill-${clean}`;
  };

  return (
    <UserLayout pageTitle="HR Calendar & Event Management">
      <div className="hr-calendar-container">
        {/* ── Feedback Banner ── */}
        {feedback.message && (
          <div className={`hr-cal-conflict-banner ${feedback.type === 'error' ? 'error' : ''}`} style={{ background: feedback.type === 'error' ? '#fef2f2' : '#ecfdf5', borderColor: feedback.type === 'error' ? '#fecaca' : '#a7f3d0', color: feedback.type === 'error' ? '#991b1b' : '#065f46' }}>
            <strong>{feedback.type === 'error' ? 'Error:' : 'Success:'}</strong> {feedback.message}
          </div>
        )}

        {/* ── Hero Header & Actions ── */}
        <div className="hr-cal-header-card">
          <div className="hr-cal-header-top">
            <div className="hr-cal-titles">
              <span className="hr-cal-kicker">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Enterprise Scheduling Center
              </span>
              <h1 className="hr-cal-title">HR Calendar & Event Management</h1>
              <p className="hr-cal-sub">Coordinate employee meetings, manage interview pipelines, view team agendas, and track company milestones.</p>
            </div>

            <div className="hr-cal-header-actions">
              <button type="button" className="hr-cal-btn hr-cal-btn-primary" onClick={() => { setShowAddModal(true); setConflictWarning(null); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add Event
              </button>
              <button type="button" className="hr-cal-btn hr-cal-btn-interview" onClick={() => { setShowInterviewModal(true); setConflictWarning(null); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                Schedule Interview
              </button>
            </div>
          </div>

          {/* ── KPI Summary Strip ── */}
          <div className="hr-cal-stats-strip">
            <div className="hr-cal-stat-item">
              <div className="hr-cal-stat-icon orange">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              </div>
              <div className="hr-cal-stat-info">
                <span className="hr-cal-stat-label">Total Events</span>
                <span className="hr-cal-stat-value">{stats.totalMonth}</span>
              </div>
            </div>

            <div className="hr-cal-stat-item">
              <div className="hr-cal-stat-icon purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
              </div>
              <div className="hr-cal-stat-info">
                <span className="hr-cal-stat-label">Interviews</span>
                <span className="hr-cal-stat-value">{stats.interviews}</span>
              </div>
            </div>

            <div className="hr-cal-stat-item">
              <div className="hr-cal-stat-icon blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <div className="hr-cal-stat-info">
                <span className="hr-cal-stat-label">HR Meetings</span>
                <span className="hr-cal-stat-value">{stats.hrMeetings}</span>
              </div>
            </div>

            <div className="hr-cal-stat-item">
              <div className="hr-cal-stat-icon emerald">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 14 14" /></svg>
              </div>
              <div className="hr-cal-stat-info">
                <span className="hr-cal-stat-label">Today's Schedule</span>
                <span className="hr-cal-stat-value">{stats.todayCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation & Filters Toolbar ── */}
        <div className="hr-cal-toolbar-card">
          <div className="hr-cal-nav-row">
            <div className="hr-cal-nav-left">
              <button type="button" className="hr-cal-today-btn" onClick={handleToday}>Today</button>
              <button type="button" className="hr-cal-nav-btn" onClick={() => handleNavigate(-1)} aria-label="Previous">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" className="hr-cal-nav-btn" onClick={() => handleNavigate(1)} aria-label="Next">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <h2 className="hr-cal-heading-title">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            <div className="hr-cal-view-pills">
              <button type="button" className={`hr-cal-view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
              <button type="button" className={`hr-cal-view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
              <button type="button" className={`hr-cal-view-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Day</button>
              <button type="button" className={`hr-cal-view-btn ${view === 'agenda' ? 'active' : ''}`} onClick={() => setView('agenda')}>Agenda</button>
            </div>
          </div>

          <div className="hr-cal-filters-row">
            <div className="hr-cal-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search by title, candidate, position..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <select className="hr-cal-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All Event Types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select className="hr-cal-filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              {['HR', 'Tech', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select className="hr-cal-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <label className="hr-cal-toggle-leave">
              <input type="checkbox" checked={showLeaves} onChange={(e) => setShowLeaves(e.target.checked)} />
              <span>Show Approved Leaves</span>
            </label>
          </div>
        </div>

        {/* ── Main Calendar Body + Sidebar ── */}
        <div className="hr-cal-main-layout">
          <div className="hr-cal-view-container">
            {loading ? (
              <div className="hr-cal-empty-state">
                <div className="hr-cal-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="6" x2="12" y2="12" /><line x1="12" y1="12" x2="16" y2="14" /></svg>
                </div>
                <h3>Loading Calendar...</h3>
                <p>Retrieving schedule and interview records from database.</p>
              </div>
            ) : view === 'month' ? (
              /* ── MONTH VIEW ── */
              <div className="hr-month-grid">
                <div className="hr-month-weekdays-header">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="hr-month-weekday-cell">{d}</div>
                  ))}
                </div>

                <div className="hr-month-days-body">
                  {monthDays.map(({ date, isCurrentMonth }) => {
                    const dateKey = date.toISOString().slice(0, 10);
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={dateKey}
                        className={`hr-month-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                        onClick={() => {
                          setEventForm({ ...defaultEventForm, date: dateKey });
                          setShowAddModal(true);
                        }}
                      >
                        <div className="hr-month-day-top">
                          <span className="hr-month-day-number">{date.getDate()}</span>
                          <button
                            type="button"
                            className="hr-month-add-quick"
                            title="Add event on this day"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventForm({ ...defaultEventForm, date: dateKey });
                              setShowAddModal(true);
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div className="hr-month-events-stack">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <div
                              key={ev._id}
                              className={`hr-cal-event-pill ${getPillClass(ev.type, ev.isLeave)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventDetails(ev);
                              }}
                              title={`${ev.title} (${new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                            >
                              <span className="hr-pill-time">
                                {new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="hr-pill-title">{ev.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <button
                              type="button"
                              className="hr-cal-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentDate(date);
                                setView('day');
                              }}
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : view === 'week' ? (
              /* ── WEEK VIEW ── */
              <div className="hr-week-view-container">
                <div className="hr-week-header">
                  <div className="hr-week-header-corner">Time</div>
                  {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() - d.getDay() + offset);
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <div key={offset} className={`hr-week-header-day ${isToday ? 'today' : ''}`}>
                        <span className="hr-week-day-name">{d.toLocaleDateString('default', { weekday: 'short' })}</span>
                        <span className="hr-week-day-num">{d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="hr-week-body">
                  <div className="hr-week-time-col">
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour) => (
                      <div key={hour} className="hr-week-time-slot">
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>

                  {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() - d.getDay() + offset);
                    const dateKey = d.toISOString().slice(0, 10);
                    const dayEvents = eventsByDate[dateKey] || [];

                    return (
                      <div key={offset} className="hr-week-day-col">
                        {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour) => (
                          <div
                            key={hour}
                            className="hr-week-hour-cell"
                            onClick={() => {
                              const timeStr = `${String(hour).padStart(2, '0')}:00`;
                              const endHour = hour + 1;
                              const endStr = `${String(endHour).padStart(2, '0')}:00`;
                              setEventForm({ ...defaultEventForm, date: dateKey, startTime: timeStr, endTime: endStr });
                              setShowAddModal(true);
                            }}
                          />
                        ))}

                        {dayEvents.map((ev) => {
                          const s = new Date(ev.startAt);
                          const e = new Date(ev.endAt);
                          const startHour = s.getHours() + s.getMinutes() / 60;
                          const endHour = e.getHours() + e.getMinutes() / 60;
                          const top = Math.max(0, (startHour - 8) * 54);
                          const height = Math.max(26, (endHour - startHour) * 54);

                          return (
                            <div
                              key={ev._id}
                              className={`hr-week-event-card ${getPillClass(ev.type, ev.isLeave)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => openEventDetails(ev)}
                            >
                              <strong>{ev.title}</strong>
                              <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>
                                {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : view === 'day' ? (
              /* ── DAY VIEW ── */
              <div className="hr-day-view-container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    Schedule for {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <button
                    type="button"
                    className="hr-cal-btn hr-cal-btn-primary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setEventForm({ ...defaultEventForm, date: currentDate.toISOString().slice(0, 10) });
                      setShowAddModal(true);
                    }}
                  >
                    + Add Event
                  </button>
                </div>

                {eventsByDate[currentDate.toISOString().slice(0, 10)]?.length ? (
                  <div className="hr-day-schedule-list">
                    {eventsByDate[currentDate.toISOString().slice(0, 10)].map((ev) => (
                      <div key={ev._id} className={`hr-day-event-row ${getPillClass(ev.type, ev.isLeave)}`} onClick={() => openEventDetails(ev)}>
                        <div className="hr-day-event-left">
                          <div className="hr-day-time-badge">
                            <span>{new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              {new Date(ev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="hr-day-event-info">
                            <h4 className="hr-day-event-title">{ev.title}</h4>
                            <div className="hr-day-event-sub">
                              <span>📁 {ev.type}</span>
                              {ev.department && <span>🏢 {ev.department}</span>}
                              {ev.location && <span>📍 {ev.location}</span>}
                              {ev.meetingLink && <span>🔗 Online Video</span>}
                              {ev.candidateName && <span>👤 Candidate: {ev.candidateName}</span>}
                            </div>
                          </div>
                        </div>

                        <span className={`hr-cal-event-pill ${getPillClass(ev.type, ev.isLeave)}`} style={{ padding: '0.35rem 0.75rem' }}>
                          {ev.status || 'Scheduled'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="hr-cal-empty-state">
                    <div className="hr-cal-empty-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <h3>No events scheduled for this day</h3>
                    <p>Click below to schedule an HR meeting or candidate interview.</p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button type="button" className="hr-cal-btn hr-cal-btn-primary" onClick={() => { setEventForm({ ...defaultEventForm, date: currentDate.toISOString().slice(0, 10) }); setShowAddModal(true); }}>
                        + Add Event
                      </button>
                      <button type="button" className="hr-cal-btn hr-cal-btn-interview" onClick={() => { setInterviewForm({ ...defaultInterviewForm, interviewDate: currentDate.toISOString().slice(0, 10) }); setShowInterviewModal(true); }}>
                        Schedule Interview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── AGENDA / LIST VIEW ── */
              <div className="hr-agenda-view-container">
                {Object.keys(eventsByDate).length ? (
                  Object.keys(eventsByDate)
                    .sort()
                    .map((dateKey) => (
                      <div key={dateKey} className="hr-agenda-day-group">
                        <div className="hr-agenda-date-heading">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', color: '#ea580c' }}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          {new Date(dateKey).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {eventsByDate[dateKey].map((ev) => (
                          <div key={ev._id} className={`hr-day-event-row ${getPillClass(ev.type, ev.isLeave)}`} onClick={() => openEventDetails(ev)}>
                            <div className="hr-day-event-left">
                              <div className="hr-day-time-badge">
                                <span>{new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                  {new Date(ev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="hr-day-event-info">
                                <h4 className="hr-day-event-title">{ev.title}</h4>
                                <div className="hr-day-event-sub">
                                  <span>🏷️ {ev.type}</span>
                                  {ev.department && <span>🏢 {ev.department}</span>}
                                  {ev.candidateName && <span>👤 Candidate: {ev.candidateName}</span>}
                                  {ev.location && <span>📍 {ev.location}</span>}
                                </div>
                              </div>
                            </div>
                            <span className={`hr-cal-event-pill ${getPillClass(ev.type, ev.isLeave)}`} style={{ padding: '0.35rem 0.75rem' }}>
                              {ev.status || 'Scheduled'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                ) : (
                  <div className="hr-cal-empty-state">
                    <div className="hr-cal-empty-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    </div>
                    <h3>No events found for this filter</h3>
                    <p>Adjust your search criteria or create a new event.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar Quick Panels ── */}
          <div className="hr-cal-side-panels">
            {/* Today's Agenda */}
            <div className="hr-cal-side-card">
              <h3 className="hr-cal-side-title">
                <span>Today's Agenda</span>
                <span className="hr-cal-side-badge">
                  {eventsByDate[new Date().toISOString().slice(0, 10)]?.length || 0}
                </span>
              </h3>
              {eventsByDate[new Date().toISOString().slice(0, 10)]?.length ? (
                eventsByDate[new Date().toISOString().slice(0, 10)].map((ev) => (
                  <div key={ev._id} className="hr-cal-agenda-item" onClick={() => openEventDetails(ev)}>
                    <div className="hr-cal-agenda-top">
                      <span className="hr-cal-agenda-item-title">{ev.title}</span>
                      <span className={`hr-cal-event-pill ${getPillClass(ev.type, ev.isLeave)}`}>
                        {ev.type}
                      </span>
                    </div>
                    <div className="hr-cal-agenda-item-meta">
                      <span>⏰ {new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.location && <span>📍 {ev.location}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>No events scheduled for today.</p>
              )}
            </div>

            {/* Upcoming Candidate Interviews */}
            <div className="hr-cal-side-card">
              <h3 className="hr-cal-side-title">
                <span>Interview Pipeline</span>
                <span className="hr-cal-side-badge" style={{ background: '#eef2ff', color: '#6366f1' }}>
                  {events.filter((e) => e.type === 'Interview').length}
                </span>
              </h3>
              {events.filter((e) => e.type === 'Interview').length ? (
                events
                  .filter((e) => e.type === 'Interview')
                  .slice(0, 4)
                  .map((iv) => (
                    <div key={iv._id} className="hr-cal-agenda-item" onClick={() => openEventDetails(iv)}>
                      <div className="hr-cal-agenda-top">
                        <span className="hr-cal-agenda-item-title">{iv.candidateName || iv.title}</span>
                        <span className="hr-cal-event-pill hr-pill-interview">{iv.interviewRound || 'Interview'}</span>
                      </div>
                      <div className="hr-cal-agenda-item-meta">
                        <span>📅 {new Date(iv.startAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(iv.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {iv.jobPosition && (
                        <div style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 }}>
                          Role: {iv.jobPosition}
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>No scheduled interviews.</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 1: ADD HR EVENT MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {showAddModal && (
          <div className="hr-cal-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="hr-cal-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="hr-cal-modal-header">
                <h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#ea580c' }}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Create HR Event
                </h3>
                <button type="button" className="hr-cal-modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleCreateEvent}>
                <div className="hr-cal-modal-body">
                  {conflictWarning && (
                    <div className="hr-cal-conflict-banner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                      <div>{conflictWarning}</div>
                    </div>
                  )}

                  <div className="hr-cal-form-group full-width">
                    <label>Event Title *</label>
                    <input
                      type="text"
                      className="hr-cal-input"
                      placeholder="e.g. Monthly All-Hands Meeting"
                      required
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    />
                  </div>

                  <div className="hr-cal-form-grid">
                    <div className="hr-cal-form-group">
                      <label>Event Type</label>
                      <select className="hr-cal-select" value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}>
                        {EVENT_TYPES.filter((t) => t !== 'Leave / Holiday').map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Department</label>
                      <select className="hr-cal-select" value={eventForm.department} onChange={(e) => setEventForm({ ...eventForm, department: e.target.value })}>
                        <option value="All Departments">All Departments</option>
                        {['HR', 'Tech', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor'].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        className="hr-cal-input"
                        required
                        value={eventForm.date}
                        onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label>Start Time *</label>
                        <input
                          type="time"
                          className="hr-cal-input"
                          required
                          value={eventForm.startTime}
                          onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label>End Time *</label>
                        <input
                          type="time"
                          className="hr-cal-input"
                          required
                          value={eventForm.endTime}
                          onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="hr-cal-form-group full-width">
                      <label>Organizer / Lead</label>
                      <select
                        className="hr-cal-select"
                        value={eventForm.assignedTo}
                        onChange={(e) => setEventForm({ ...eventForm, assignedTo: e.target.value })}
                      >
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email} ({emp.jobDetails?.department || emp.department || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-cal-form-group full-width">
                      <label>Attendees / Participants ({eventForm.participants.length} selected)</label>
                      <div className="hr-cal-chips-container">
                        {employees.map((emp) => {
                          const isSelected = eventForm.participants.includes(emp._id);
                          const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                          return (
                            <span
                              key={emp._id}
                              className={`hr-cal-user-chip ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                const newPart = isSelected
                                  ? eventForm.participants.filter((id) => id !== emp._id)
                                  : [...eventForm.participants, emp._id];
                                setEventForm({ ...eventForm, participants: newPart });
                              }}
                            >
                              {isSelected && '✓ '}
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Location / Room</label>
                      <input
                        type="text"
                        className="hr-cal-input"
                        placeholder="e.g. Conference Room A"
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Online Meeting Link</label>
                      <input
                        type="url"
                        className="hr-cal-input"
                        placeholder="e.g. https://meet.google.com/xyz"
                        value={eventForm.meetingLink}
                        onChange={(e) => setEventForm({ ...eventForm, meetingLink: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="hr-cal-form-group full-width">
                    <label>Description / Agenda</label>
                    <textarea
                      className="hr-cal-textarea"
                      placeholder="Add agenda notes or discussion points..."
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="hr-cal-modal-footer">
                  <button type="button" className="hr-cal-btn hr-cal-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="hr-cal-btn hr-cal-btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 2: SCHEDULE INTERVIEW MODAL (RECRUITMENT INTEGRATED)
            ═══════════════════════════════════════════════════════════════ */}
        {showInterviewModal && (
          <div className="hr-cal-modal-overlay" onClick={() => setShowInterviewModal(false)}>
            <div className="hr-cal-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="hr-cal-modal-header">
                <h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: '#6366f1' }}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  Schedule Candidate Interview
                </h3>
                <button type="button" className="hr-cal-modal-close" onClick={() => setShowInterviewModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleScheduleInterview}>
                <div className="hr-cal-modal-body">
                  {conflictWarning && (
                    <div className="hr-cal-conflict-banner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                      <div>{conflictWarning}</div>
                    </div>
                  )}

                  <div className="hr-cal-form-group full-width">
                    <label>Select Candidate from Recruitment Pipeline</label>
                    <select
                      className="hr-cal-select"
                      value={interviewForm.candidateId}
                      onChange={(e) => handleSelectCandidate(e.target.value)}
                    >
                      <option value="">-- Select Candidate or Enter Manually --</option>
                      {candidates.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} — {c.appliedPosition || 'Candidate'} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hr-cal-form-grid">
                    <div className="hr-cal-form-group">
                      <label>Candidate Name *</label>
                      <input
                        type="text"
                        className="hr-cal-input"
                        required
                        placeholder="e.g. Alex Rivera"
                        value={interviewForm.candidateName}
                        onChange={(e) => setInterviewForm({ ...interviewForm, candidateName: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Candidate Email *</label>
                      <input
                        type="email"
                        className="hr-cal-input"
                        required
                        placeholder="e.g. alex@example.com"
                        value={interviewForm.candidateEmail}
                        onChange={(e) => setInterviewForm({ ...interviewForm, candidateEmail: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Applied Job Position *</label>
                      <input
                        type="text"
                        className="hr-cal-input"
                        required
                        placeholder="e.g. Senior Frontend Engineer"
                        value={interviewForm.jobPosition}
                        onChange={(e) => setInterviewForm({ ...interviewForm, jobPosition: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Interview Round</label>
                      <select
                        className="hr-cal-select"
                        value={interviewForm.interviewRound}
                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewRound: e.target.value })}
                      >
                        {INTERVIEW_ROUNDS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Interview Date *</label>
                      <input
                        type="date"
                        className="hr-cal-input"
                        required
                        value={interviewForm.interviewDate}
                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Time Slot (Start & End) *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <input
                          type="time"
                          className="hr-cal-input"
                          required
                          value={interviewForm.startTime}
                          onChange={(e) => setInterviewForm({ ...interviewForm, startTime: e.target.value })}
                        />
                        <input
                          type="time"
                          className="hr-cal-input"
                          required
                          value={interviewForm.endTime}
                          onChange={(e) => setInterviewForm({ ...interviewForm, endTime: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Lead Interviewer *</label>
                      <select
                        className="hr-cal-select"
                        value={interviewForm.assignedTo}
                        onChange={(e) => setInterviewForm({ ...interviewForm, assignedTo: e.target.value })}
                      >
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email} ({emp.jobDetails?.department || emp.department || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-cal-form-group">
                      <label>Interview Format</label>
                      <select
                        className="hr-cal-select"
                        value={interviewForm.interviewType}
                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewType: e.target.value })}
                      >
                        <option value="Online Video">Online Video Meeting</option>
                        <option value="In-Person">In-Person Office</option>
                        <option value="Telephonic">Telephonic Call</option>
                      </select>
                    </div>

                    <div className="hr-cal-form-group full-width">
                      <label>{interviewForm.interviewType === 'Online Video' ? 'Video Meeting Link (Google Meet / Zoom)' : 'Location / Phone'}</label>
                      <input
                        type="text"
                        className="hr-cal-input"
                        placeholder={interviewForm.interviewType === 'Online Video' ? 'https://meet.google.com/...' : 'Office Room 101 or Phone number'}
                        value={interviewForm.interviewType === 'Online Video' ? interviewForm.meetingLink : interviewForm.location}
                        onChange={(e) =>
                          interviewForm.interviewType === 'Online Video'
                            ? setInterviewForm({ ...interviewForm, meetingLink: e.target.value })
                            : setInterviewForm({ ...interviewForm, location: e.target.value })
                        }
                      />
                    </div>

                    <div className="hr-cal-form-group full-width">
                      <label>Interview Notes & Evaluation Criteria</label>
                      <textarea
                        className="hr-cal-textarea"
                        rows="2"
                        placeholder="Add technical requirements, evaluation criteria, or instructions..."
                        value={interviewForm.notes}
                        onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-cal-modal-footer">
                  <button type="button" className="hr-cal-btn hr-cal-btn-secondary" onClick={() => setShowInterviewModal(false)}>Cancel</button>
                  <button type="submit" className="hr-cal-btn hr-cal-btn-interview" disabled={actionLoading}>
                    {actionLoading ? 'Scheduling...' : 'Schedule Interview'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 3: EVENT / INTERVIEW DETAILS MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {showDetailsModal && selectedEvent && (
          <div className="hr-cal-modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="hr-cal-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="hr-cal-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className={`hr-cal-event-pill ${getPillClass(selectedEvent.type, selectedEvent.isLeave)}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    {selectedEvent.type}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                    Status: <strong style={{ color: selectedEvent.status === 'Cancelled' ? '#ef4444' : '#059669' }}>{selectedEvent.status || 'Scheduled'}</strong>
                  </span>
                </div>
                <button type="button" className="hr-cal-modal-close" onClick={() => setShowDetailsModal(false)}>&times;</button>
              </div>

              <div className="hr-cal-modal-body">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {selectedEvent.title}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Date</span>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 700, color: '#0f172a' }}>
                      {new Date(selectedEvent.startAt).toLocaleDateString('default', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Time</span>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 700, color: '#0f172a' }}>
                      {new Date(selectedEvent.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedEvent.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {selectedEvent.department && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Department</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: '#0f172a' }}>{selectedEvent.department}</p>
                    </div>
                  )}

                  {selectedEvent.location && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Location</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: '#0f172a' }}>{selectedEvent.location}</p>
                    </div>
                  )}
                </div>

                {/* Candidate Card (For Interviews) */}
                {selectedEvent.type === 'Interview' && (
                  <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '1rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Candidate Information</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div><strong>Name:</strong> {selectedEvent.candidateName || selectedEvent.candidate?.name || '—'}</div>
                      <div><strong>Email:</strong> {selectedEvent.candidateEmail || selectedEvent.candidate?.email || '—'}</div>
                      <div><strong>Position:</strong> {selectedEvent.jobPosition || selectedEvent.candidate?.appliedPosition || '—'}</div>
                      <div><strong>Round:</strong> {selectedEvent.interviewRound || 'Technical'}</div>
                    </div>
                  </div>
                )}

                {/* Video Meeting Link */}
                {selectedEvent.meetingLink && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 600, fontSize: '0.85rem' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      <span>Online Meeting</span>
                    </div>
                    <a
                      href={selectedEvent.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hr-cal-btn hr-cal-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      Join Call ↗
                    </a>
                  </div>
                )}

                {/* Organizer & Attendees */}
                {selectedEvent.assignedTo && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Organizer</span>
                    <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: '#0f172a' }}>
                      {selectedEvent.assignedTo?.firstName ? `${selectedEvent.assignedTo.firstName} ${selectedEvent.assignedTo.lastName || ''}` : 'HR Manager'} ({selectedEvent.assignedTo?.email || 'hr@example.com'})
                    </p>
                  </div>
                )}

                {selectedEvent.participants?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Attendees ({selectedEvent.participants.length})</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                      {selectedEvent.participants.map((p) => (
                        <span key={p._id || p} className="hr-cal-user-chip" style={{ cursor: 'default' }}>
                          👤 {p.firstName ? `${p.firstName} ${p.lastName || ''}` : p.email || 'Staff'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description / Notes */}
                {(selectedEvent.description || selectedEvent.notes) && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Notes & Agenda</span>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#334155', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                      {selectedEvent.notes || selectedEvent.description}
                    </p>
                  </div>
                )}
              </div>

              {!selectedEvent.isLeave && (
                <div className="hr-cal-modal-footer" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="hr-cal-btn" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }} onClick={handleDeleteEvent} disabled={actionLoading}>
                      Delete
                    </button>
                    {selectedEvent.status !== 'Cancelled' && (
                      <button type="button" className="hr-cal-btn hr-cal-btn-secondary" onClick={handleCancelEvent} disabled={actionLoading}>
                        Cancel Event
                      </button>
                    )}
                  </div>

                  <button type="button" className="hr-cal-btn hr-cal-btn-primary" onClick={openRescheduleModal}>
                    ⏱️ Reschedule
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 4: QUICK RESCHEDULE MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {showRescheduleModal && (
          <div className="hr-cal-modal-overlay" onClick={() => setShowRescheduleModal(false)}>
            <div className="hr-cal-modal-box" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <div className="hr-cal-modal-header">
                <h3>⏱️ Reschedule Event</h3>
                <button type="button" className="hr-cal-modal-close" onClick={() => setShowRescheduleModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleQuickReschedule}>
                <div className="hr-cal-modal-body">
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Select a new date and time slot for <strong>"{selectedEvent?.title}"</strong>.
                  </p>

                  <div className="hr-cal-form-group full-width">
                    <label>New Date *</label>
                    <input
                      type="date"
                      className="hr-cal-input"
                      required
                      value={rescheduleData.date}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                    />
                  </div>

                  <div className="hr-cal-form-grid">
                    <div className="hr-cal-form-group">
                      <label>Start Time *</label>
                      <input
                        type="time"
                        className="hr-cal-input"
                        required
                        value={rescheduleData.startTime}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, startTime: e.target.value })}
                      />
                    </div>
                    <div className="hr-cal-form-group">
                      <label>End Time *</label>
                      <input
                        type="time"
                        className="hr-cal-input"
                        required
                        value={rescheduleData.endTime}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, endTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="hr-cal-form-group full-width">
                    <label>Reason / Note for Attendees</label>
                    <input
                      type="text"
                      className="hr-cal-input"
                      placeholder="e.g. Moved due to interviewer scheduling conflict"
                      value={rescheduleData.notes}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="hr-cal-modal-footer">
                  <button type="button" className="hr-cal-btn hr-cal-btn-secondary" onClick={() => setShowRescheduleModal(false)}>Cancel</button>
                  <button type="submit" className="hr-cal-btn hr-cal-btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Updating...' : 'Confirm Reschedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
