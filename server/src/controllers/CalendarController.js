import mongoose from 'mongoose';
import CalendarEvent from '../models/CalendarEvent.js';
import Notification from '../models/Notification.js';
import Candidate from '../models/Candidate.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isAuthorized = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const id = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw createValidationError(`Invalid ${field}`);
  return value;
};

const scope = (user) =>
  isAuthorized(user) ? {} : { $or: [{ assignedTo: user.userId }, { participants: user.userId }] };

const findAllowed = async (eventId, user) => {
  id(eventId, 'event id');
  const query = isAuthorized(user) ? { _id: eventId } : { _id: eventId, ...scope(user) };
  const event = await CalendarEvent.findOne(query);
  if (!event) throw createNotFoundError('Calendar event not found');
  return event;
};

const fields = [
  'title',
  'description',
  'startAt',
  'endAt',
  'location',
  'meetingLink',
  'department',
  'type',
  'status',
  'reminderMinutes',
  'assignedTo',
  'participants',
  'candidate',
  'candidateName',
  'candidateEmail',
  'candidatePhone',
  'jobPosition',
  'interviewRound',
  'interviewType',
  'notes',
];

const payload = (body) =>
  Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const validatePayload = (data) => {
  if (data.assignedTo) id(data.assignedTo, 'assigned user');
  if (data.candidate && data.candidate !== '') id(data.candidate, 'candidate reference');
  if (data.participants) {
    if (!Array.isArray(data.participants)) throw createValidationError('Participants must be an array');
    data.participants.forEach((value) => id(value, 'participant'));
  }
  if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
    throw createValidationError('End time must be after start time');
  }
};

const populate = (query) =>
  query
    .populate('assignedTo', 'firstName lastName email department designation personalInfo')
    .populate('participants', 'firstName lastName email department designation personalInfo')
    .populate('createdBy', 'firstName lastName email department')
    .populate('candidate', 'name email phone appliedPosition department status stage');

export const CalendarController = {
  list: asyncHandler(async (req, res) => {
    const filter = scope(req.user);
    if (req.query.from || req.query.to) filter.startAt = {};
    if (req.query.from) filter.startAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.startAt.$lt = new Date(req.query.to);
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { candidateName: { $regex: req.query.search, $options: 'i' } },
        { jobPosition: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.type && req.query.type !== 'All') {
      filter.type = req.query.type;
    }
    if (req.query.department && req.query.department !== 'All') {
      filter.department = req.query.department;
    }
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    const events = await populate(CalendarEvent.find(filter).sort({ startAt: 1 }));
    res.json(successResponse(events, 'Calendar events retrieved'));
  }),

  get: asyncHandler(async (req, res) => {
    const event = await populate(CalendarEvent.findById(req.params.id));
    if (!event) throw createNotFoundError('Calendar event not found');
    res.json(successResponse(event, 'Calendar event retrieved'));
  }),

  checkConflict: asyncHandler(async (req, res) => {
    const { startAt, endAt, userIds, excludeEventId } = req.body;
    if (!startAt || !endAt || !Array.isArray(userIds) || userIds.length === 0) {
      return res.json(successResponse({ hasConflict: false, conflicts: [] }, 'No conflict'));
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    const validUserIds = userIds.filter((uid) => mongoose.Types.ObjectId.isValid(uid));

    const conflictFilter = {
      status: { $ne: 'Cancelled' },
      startAt: { $lt: end },
      endAt: { $gt: start },
      $or: [{ assignedTo: { $in: validUserIds } }, { participants: { $in: validUserIds } }],
    };

    if (excludeEventId && mongoose.Types.ObjectId.isValid(excludeEventId)) {
      conflictFilter._id = { $ne: excludeEventId };
    }

    const conflicts = await populate(CalendarEvent.find(conflictFilter));
    res.json(
      successResponse(
        {
          hasConflict: conflicts.length > 0,
          conflicts,
        },
        conflicts.length > 0 ? 'Scheduling conflicts detected' : 'No conflicts'
      )
    );
  }),

  create: asyncHandler(async (req, res) => {
    if (!isAuthorized(req.user)) {
      throw createForbiddenError('Only HR managers and administrators can create calendar events');
    }

    const data = payload(req.body);
    if (!data.assignedTo) {
      data.assignedTo = req.user.userId;
    }
    validatePayload(data);

    if (!data.title || !data.startAt || !data.endAt || !data.assignedTo) {
      throw createValidationError('Title, start time, end time, and assigned organizer are required');
    }

    const event = await CalendarEvent.create({ ...data, createdBy: req.user.userId });

    // Link interview with Candidate model if candidate reference is passed
    if (data.candidate && data.candidate !== '') {
      await Candidate.findByIdAndUpdate(data.candidate, {
        $push: {
          interviews: {
            round: data.interviewRound || 'Technical Round 1',
            interviewer: data.candidateName ? `Interviewer for ${data.candidateName}` : 'HR Panel',
            interviewerId: data.assignedTo,
            date: new Date(data.startAt),
            time: new Date(data.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: data.interviewType || 'Online Video',
            meetingLink: data.meetingLink || '',
            notes: data.notes || data.description || '',
            status: 'Scheduled',
          },
        },
      }).catch(() => {});
    }

    // Send notification to participants & assigned user
    const recipientIds = new Set([
      ...(data.participants || []).map(String),
      String(data.assignedTo),
    ]);
    recipientIds.delete(String(req.user.userId));

    if (recipientIds.size > 0) {
      const notifs = Array.from(recipientIds).map((recipientId) => ({
        recipient: recipientId,
        title: `Calendar Event: ${data.title}`,
        message: `You have been scheduled for "${data.title}" on ${new Date(data.startAt).toLocaleString()}`,
        type: 'Info',
      }));
      await Notification.insertMany(notifs).catch(() => {});
    }

    res.status(201).json(createdResponse(await populate(CalendarEvent.findById(event._id)), 'Calendar event created successfully'));
  }),

  update: asyncHandler(async (req, res) => {
    if (!isAuthorized(req.user)) {
      throw createForbiddenError('Only HR managers and administrators can update calendar events');
    }

    const event = await findAllowed(req.params.id, req.user);
    const data = payload(req.body);
    validatePayload({ ...event.toObject(), ...data });

    Object.assign(event, data);
    await event.save();

    res.json(successResponse(await populate(CalendarEvent.findById(event._id)), 'Calendar event updated successfully'));
  }),

  remove: asyncHandler(async (req, res) => {
    if (!isAuthorized(req.user)) {
      throw createForbiddenError('Only HR managers and administrators can delete calendar events');
    }

    const event = await findAllowed(req.params.id, req.user);
    await event.deleteOne();
    res.json(successResponse({ id: req.params.id }, 'Calendar event deleted successfully'));
  }),
};
