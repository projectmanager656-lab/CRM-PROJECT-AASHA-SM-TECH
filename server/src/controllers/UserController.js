import UserService from '../services/UserService.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class UserController {
  static getUsers = asyncHandler(async (req, res) => {
    const users = await UserService.getAllUsers({ department: req.query.department });
    res.json(successResponse(users, 'Users retrieved successfully'));
  });

  static getUserById = asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id);
    res.json(successResponse(user, 'User retrieved successfully'));
  });

  static createUser = asyncHandler(async (req, res) => {
    const user = await UserService.createUser(req.body, req.user?.userId);
    res.status(201).json(createdResponse(user, 'User created successfully'));
  });

  static updateUser = asyncHandler(async (req, res) => {
    const user = await UserService.updateUser(req.params.id, req.body, req.user?.userId);
    res.json(successResponse(user, 'User updated successfully'));
  });

  static transferEmployee = asyncHandler(async (req, res) => {
    const user = await UserService.transferEmployee(req.params.id, req.body, req.user?.userId);
    res.json(successResponse(user, 'Employee transfer / role change applied successfully'));
  });

  static updateStatus = asyncHandler(async (req, res) => {
    const user = await UserService.updateEmployeeStatus(req.params.id, req.body, req.user?.userId);
    res.json(successResponse(user, 'Employee status updated successfully'));
  });

  static getEmployeeHistory = asyncHandler(async (req, res) => {
    const history = await UserService.getEmployeeHistory(req.params.id);
    res.json(successResponse(history, 'Employee history retrieved successfully'));
  });

  static deactivateUser = asyncHandler(async (req, res) => {
    const user = await UserService.deactivateUser(req.params.id, req.user?.userId);
    res.json(successResponse(user, 'User deactivated successfully'));
  });
}

export default UserController;
