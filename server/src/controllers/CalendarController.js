import mongoose from 'mongoose';
import CalendarEvent from '../models/CalendarEvent.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const admin = (user) => ['admin', 'super_admin'].includes(user.role);
const id = (value, field) => { if (!mongoose.Types.ObjectId.isValid(value)) throw createValidationError(`Invalid ${field}`); return value; };
const scope = (user) => admin(user) ? {} : { $or: [{ assignedTo: user.userId }, { participants: user.userId }] };
const findAllowed = async (eventId, user) => {
  id(eventId, 'event id');
  const event = await CalendarEvent.findOne({ _id: eventId, ...scope(user) });
  if (!event) throw createNotFoundError('Calendar event not found');
  return event;
};
const fields = ['title', 'description', 'startAt', 'endAt', 'location', 'type', 'status', 'reminderMinutes', 'assignedTo', 'participants'];
const payload = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const validatePayload = (data) => {
  if (data.assignedTo) id(data.assignedTo, 'assigned user');
  if (data.participants) { if (!Array.isArray(data.participants)) throw createValidationError('Participants must be an array'); data.participants.forEach((value) => id(value, 'participant')); }
  if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt)) throw createValidationError('End time must be after start time');
};
const populate = (query) => query.populate('assignedTo participants createdBy', 'firstName lastName email');

export const CalendarController = {
  list: asyncHandler(async (req, res) => {
    const filter = scope(req.user);
    if (req.query.from || req.query.to) filter.startAt = {};
    if (req.query.from) filter.startAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.startAt.$lt = new Date(req.query.to);
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
    const events = await populate(CalendarEvent.find(filter).sort({ startAt: 1 }));
    res.json(successResponse(events, 'Calendar events retrieved'));
  }),
  get: asyncHandler(async (req, res) => res.json(successResponse(await populate(findAllowed(req.params.id, req.user)), 'Calendar event retrieved'))),
  create: asyncHandler(async (req, res) => {
    if (!admin(req.user)) throw createForbiddenError('Only administrators can create calendar events');
    const data = payload(req.body); validatePayload(data);
    if (!data.title || !data.startAt || !data.endAt || !data.assignedTo) throw createValidationError('Title, start time, end time, and assigned user are required');
    const event = await CalendarEvent.create({ ...data, createdBy: req.user.userId });
    res.status(201).json(createdResponse(await populate(CalendarEvent.findById(event._id)), 'Calendar event created'));
  }),
  update: asyncHandler(async (req, res) => {
    if (!admin(req.user)) throw createForbiddenError('Only administrators can update calendar events');
    const event = await findAllowed(req.params.id, req.user); const data = payload(req.body); validatePayload({ ...event.toObject(), ...data });
    Object.assign(event, data); await event.save();
    res.json(successResponse(await populate(CalendarEvent.findById(event._id)), 'Calendar event updated'));
  }),
  remove: asyncHandler(async (req, res) => {
    if (!admin(req.user)) throw createForbiddenError('Only administrators can delete calendar events');
    const event = await findAllowed(req.params.id, req.user); await event.deleteOne();
    res.json(successResponse({ id: req.params.id }, 'Calendar event deleted'));
  }),
};
