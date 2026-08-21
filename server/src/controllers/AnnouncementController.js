import Announcement from '../models/Announcement.js';
import { createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const admin = (user) => ['admin', 'super_admin'].includes(user.role);
const fields = ['title', 'message', 'status', 'audience'];
const pick = (body) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
const find = async (id, user) => { const item = await Announcement.findOne(admin(user) ? { _id: id } : { _id: id, status: 'Published', audience: 'All Users' }); if (!item) throw createNotFoundError('Announcement not found'); return item; };
export const AnnouncementController = {
  list: asyncHandler(async (req, res) => { const query = Announcement.find(admin(req.user) ? {} : { status: 'Published', audience: 'All Users' }).sort({ createdAt: -1 }); if (req.query.limit) query.limit(Number(req.query.limit)); res.json(successResponse(await query, 'Announcements retrieved')); }),
  get: asyncHandler(async (req, res) => res.json(successResponse(await find(req.params.id, req.user), 'Announcement retrieved'))),
  create: asyncHandler(async (req, res) => { if (!admin(req.user)) throw createValidationError('Only administrators can create announcements'); const data = pick(req.body); if (!data.title || !data.message) throw createValidationError('Title and message are required'); res.status(201).json(createdResponse(await Announcement.create({ ...data, createdBy: req.user.userId, createdByRole: req.user.role }), 'Announcement created')); }),
  update: asyncHandler(async (req, res) => { if (!admin(req.user)) throw createValidationError('Only administrators can update announcements'); const item = await find(req.params.id, req.user); Object.assign(item, pick(req.body)); await item.save(); res.json(successResponse(item, 'Announcement updated')); }),
  remove: asyncHandler(async (req, res) => { if (!admin(req.user)) throw createValidationError('Only administrators can delete announcements'); const item = await find(req.params.id, req.user); await item.deleteOne(); res.json(successResponse({ id: req.params.id }, 'Announcement deleted')); }),
};
