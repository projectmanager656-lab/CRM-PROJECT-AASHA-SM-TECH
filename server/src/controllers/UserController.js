import UserService from '../services/UserService.js';
import { createValidationError } from '../utils/apiError.js';
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
    const user = await UserService.createUser(req.body);
    res.status(201).json(createdResponse(user, 'User created successfully'));
  });

  static updateUser = asyncHandler(async (req, res) => {
    const user = await UserService.updateUser(req.params.id, req.body, req.user?.userId);
    res.json(successResponse(user, 'User updated successfully'));
  });

  static deactivateUser = asyncHandler(async (req, res) => {
    const user = await UserService.deactivateUser(req.params.id, req.user?.userId);
    res.json(successResponse(user, 'User deactivated successfully'));
  });
}

export default UserController;
