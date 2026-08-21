import mongoose from 'mongoose';
import User from '../models/User.js';
import { NON_TECH_LEAD_DEPARTMENTS } from '../config/departments.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';

export class OwnedResourceService {
  constructor(Model, allowedFields, requiredFields = []) {
    this.Model = Model;
    this.allowedFields = allowedFields;
    this.requiredFields = requiredFields;
  }

  scope(user) {
    return user.role === 'employee' ? { $or: [{ owner: user.userId }, { sharedWith: user.userId }] } : {};
  }

  sanitize(data, user) {
    const fields = user.role === 'employee' ? this.allowedFields.filter((key) => !['owner', 'sharedWith'].includes(key)) : this.allowedFields;
    return Object.fromEntries(fields.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  }

  async create(data, user) {
    const missing = this.requiredFields.filter((key) => !String(data[key] || '').trim());
    if (missing.length) throw createValidationError(`${missing.join(', ')} required`);
    const owner = user.role === 'employee' ? user.userId : data.owner;
    if (!owner) throw createValidationError('Assigned employee is required');
    if (this.Model.modelName === 'Lead') {
      const assignees = [owner, ...(Array.isArray(data.sharedWith) ? data.sharedWith : [])];
      const validCount = await User.countDocuments({ _id: { $in: assignees }, role: 'employee', department: { $in: NON_TECH_LEAD_DEPARTMENTS } });
      if (validCount !== assignees.length) throw createValidationError('Non-Tech leads can only be assigned to employees in HR, Sales, Business Development, or Finance');
    }
    return this.Model.create({ ...this.sanitize(data, user), owner });
  }

  async list(query, user) {
    const filter = this.scope(user);
    if (query.status) filter.status = query.status;
    if (this.Model.modelName === 'Project' && query.category) filter.category = query.category;
    if (query.search) {
      const searchFilter = { $or: ['name', 'email', 'company'].map((field) => ({ [field]: { $regex: query.search, $options: 'i' } })) };
      // Keep the employee ownership/share scope when applying a search. Replacing
      // the existing $or here would expose matching records outside that scope.
      if (filter.$or) {
        const ownershipFilter = { $or: filter.$or };
        delete filter.$or;
        filter.$and = [ownershipFilter, searchFilter];
      } else {
        Object.assign(filter, searchFilter);
      }
    }
    return this.Model.find(filter).sort({ createdAt: -1 }).populate('owner', 'firstName lastName email').populate('sharedWith', 'firstName lastName email');
  }

  async get(id, user) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('Invalid record id');
    const record = await this.Model.findById(id);
    if (!record) throw createNotFoundError('Record not found');
    if (user.role === 'employee' && String(record.owner) !== String(user.userId) && !record.sharedWith?.some((id) => String(id) === String(user.userId))) throw createForbiddenError('Access denied');
    return record;
  }

  async update(id, data, user) {
    const record = await this.get(id, user);
    Object.assign(record, this.sanitize(data, user));
    await record.save();
    return record;
  }

  async remove(id, user) {
    const record = await this.get(id, user);
    await record.deleteOne();
    return { id };
  }
}
