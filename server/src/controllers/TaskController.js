import TaskService from '../services/TaskService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createValidationError } from '../utils/apiError.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';

export class TaskController {
  static createTask = asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const payload = req.body;

    // Basic validation
    if (!payload || !payload.title) {
      throw createValidationError('Title is required');
    }

    const task = await TaskService.createTask(payload, currentUserId);
    res.status(201).json(createdResponse(task, 'Task created successfully'));
  });

  static getTasks = asyncHandler(async (req, res) => {
    const query = req.query || {};
    const tasks = await TaskService.getTasks(query, req.user);
    res.json(successResponse(tasks, 'Tasks retrieved successfully'));
  });

  static getTaskById = asyncHandler(async (req, res) => {
    const task = await TaskService.getTaskById(req.params.id, req.user);
    res.json(successResponse(task, 'Task retrieved successfully'));
  });

  static updateTask = asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const updated = await TaskService.updateTask(req.params.id, req.body, currentUserId, req.user.role);
    res.json(successResponse(updated, 'Task updated successfully'));
  });

  static deleteTask = asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.role;
    const result = await TaskService.deleteTask(req.params.id, currentUserId, currentUserRole);
    res.json(successResponse(result, 'Task deleted successfully'));
  });

  static assignTask = asyncHandler(async (req, res) => {
    const currentUserRole = req.user.role;
    const assigneeId = req.body.assignedTo;
    if (!assigneeId) {
      throw createValidationError('assignedTo (one or more user ids) is required');
    }
    const task = await TaskService.assignTask(req.params.id, assigneeId, currentUserRole);
    res.json(successResponse(task, 'Task assigned successfully'));
  });

  static updateStatus = asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.role;
    const { status } = req.body;
    if (!status) throw createValidationError('status is required');
    const task = await TaskService.updateStatus(req.params.id, status, currentUserId, currentUserRole);
    res.json(successResponse(task, 'Task status updated successfully'));
  });
}

export default TaskController;
