import Task from '../models/Task.js';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/apiError.js';
import mongoose from 'mongoose';

export class TaskService {
  // Create a new task
  static async createTask(data, currentUserId) {
    const { title, description, projectId, priority, dueDate, startDate, department, status, assignedTo = [] } = data;

    if (!title) {
      throw createValidationError('Title is required');
    }

    const task = new Task({
      title: title.trim(),
      description: description ? description.trim() : '',
      projectId: projectId ? new mongoose.Types.ObjectId(projectId) : null,
      priority: priority || 'Medium',
      dueDate: dueDate || null, startDate: startDate || null, department: department || '', status: status || 'Pending',
      createdBy: new mongoose.Types.ObjectId(currentUserId),
      assignedTo: (Array.isArray(assignedTo) ? assignedTo : [assignedTo]).filter(Boolean).map((id) => new mongoose.Types.ObjectId(id)),
    });

    await task.save();
    return task.toJSON();
  }

  // Get list of tasks with search/filter/sort
  static async getTasks(query = {}, currentUser = null) {
    const {
      search,
      status,
      priority,
      department,
      assignedTo,
      createdBy,
      projectId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      skip = 0,
    } = query;

    const filter = {};

    const isPrivileged = ['admin', 'super_admin'].includes(currentUser?.role) || currentUser?.department === 'HR';
    if (currentUser?.role === 'employee' && !isPrivileged) {
      filter.$or = [{ createdBy: currentUser.userId }, { assignedTo: currentUser.userId }];
    }

    if (search) {
      const searchFilter = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
      if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: searchFilter }], delete filter.$or;
      else filter.$or = searchFilter;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (department) filter.department = department;
    if (assignedTo) filter.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    if (createdBy) filter.createdBy = new mongoose.Types.ObjectId(createdBy);
    if (projectId) filter.projectId = new mongoose.Types.ObjectId(projectId);

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const tasks = await Task.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip(Number(skip))
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role department designation phone personalInfo')
      .populate('projectId', 'name category status');

    return tasks.map((t) => t.toJSON());
  }

  static async getTaskById(id, currentUser = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createValidationError('Invalid task id');
    }

    const task = await Task.findById(id)
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role department designation phone personalInfo')
      .populate('projectId', 'name category status');

    if (!task) {
      throw createNotFoundError('Task not found');
    }

    const isPrivileged = ['admin', 'super_admin'].includes(currentUser?.role) || currentUser?.department === 'HR';
    if (!isPrivileged && currentUser?.role === 'employee' &&
        String(task.createdBy?._id || task.createdBy) !== String(currentUser.userId) &&
        !task.assignedTo?.some((assignee) => String(assignee?._id || assignee) === String(currentUser.userId))) {
      throw createForbiddenError('You are not authorized to view this task');
    }

    return task.toJSON();
  }

  static async updateTask(id, updateData, currentUserId, currentUserRole, currentUserDepartment = '') {
    const task = await Task.findById(id);
    if (!task) throw createNotFoundError('Task not found');

    const isPrivileged = ['admin', 'super_admin'].includes(currentUserRole) || currentUserDepartment === 'HR';
    if (!isPrivileged &&
        String(task.createdBy) !== String(currentUserId) &&
        !task.assignedTo?.some((assignee) => String(assignee) === String(currentUserId))) {
      throw createForbiddenError('You are not authorized to update this task');
    }

    // Only allow certain fields to be updated
    const allowed = ['title', 'description', 'priority', 'dueDate', 'status', 'notes'];
    if (isPrivileged) allowed.push('projectId', 'assignedTo', 'startDate', 'department');
    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        task[key] = key === 'assignedTo' ? (Array.isArray(updateData[key]) ? updateData[key] : [updateData[key]]).filter(Boolean) : updateData[key];
      }
    }

    await task.save();
    return task.toJSON();
  }

  static async deleteTask(id, currentUserId, currentUserRole, currentUserDepartment = '') {
    const task = await Task.findById(id);
    if (!task) throw createNotFoundError('Task not found');

    const isPrivileged = ['admin', 'super_admin'].includes(currentUserRole) || currentUserDepartment === 'HR';
    if (!isPrivileged && String(task.createdBy) !== String(currentUserId)) {
      throw createForbiddenError('You are not authorized to delete this task');
    }

    await task.deleteOne();
    return { id }; // return deleted id
  }

  static async assignTask(id, assigneeId, currentUserRole, currentUserDepartment = '') {
    const task = await Task.findById(id);
    if (!task) throw createNotFoundError('Task not found');

    const isPrivileged = ['admin', 'super_admin'].includes(currentUserRole) || currentUserDepartment === 'HR';
    if (!isPrivileged) {
      throw createForbiddenError('Only admin, super admin, or HR can assign tasks');
    }

    task.assignedTo = (Array.isArray(assigneeId) ? assigneeId : [assigneeId]).map((id) => new mongoose.Types.ObjectId(id));
    await task.save();
    return task.toJSON();
  }

  static async updateStatus(id, status, currentUserId, currentUserRole, currentUserDepartment = '') {
    const allowedStatuses = ['Pending', 'In Progress', 'Completed', 'Overdue'];
    if (!allowedStatuses.includes(status)) {
      throw createValidationError('Invalid status');
    }

    const task = await Task.findById(id);
    if (!task) throw createNotFoundError('Task not found');

    const isPrivileged = ['admin', 'super_admin'].includes(currentUserRole) || currentUserDepartment === 'HR';
    if (!isPrivileged &&
        String(task.createdBy) !== String(currentUserId) &&
        !task.assignedTo?.some((assignee) => String(assignee) === String(currentUserId))) {
      throw createForbiddenError('You are not authorized to update status');
    }

    task.status = status;
    await task.save();
    return task.toJSON();
  }
}

export default TaskService;
