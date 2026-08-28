import Joi from 'joi';
import { SUPPORTED_DEPARTMENTS } from '../config/departments.js';

export const validateRegister = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .trim()
    .messages({
      'string.base': 'First name must be a string'
    }),
  lastName: Joi.string()
    .trim()
    .messages({
      'string.base': 'Last name must be a string'
    }),
  department: Joi.string()
    .trim()
    .messages({
      'string.base': 'Department must be a string'
    }),
  phone: Joi.string()
    .trim()
    .messages({
      'string.base': 'Phone number must be a string'
    }),
  designation: Joi.string()
    .trim()
    .messages({
      'string.base': 'Designation must be a string'
    }),
});

export const validateEmployeeRegister = validateRegister.fork(['department'], (field) => field.required().messages({
  'any.required': 'Department is required'
})).fork(['department'], (field) => field.valid(...SUPPORTED_DEPARTMENTS).messages({ 'any.only': 'Department must be HR, Sales, Business Development, Finance, Tech, or Non-Tech' }));

export const validateLogin = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
});

export default {
  validateRegister,
  validateEmployeeRegister,
  validateLogin,
};
