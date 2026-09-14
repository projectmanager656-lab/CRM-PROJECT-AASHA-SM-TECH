import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) =>
  ['admin', 'super_admin'].includes(user?.role) ||
  String(user?.department || '').trim().toUpperCase() === 'HR' ||
  String(user?.department || '').trim().toUpperCase() === 'FINANCE';

export const ExpenseController = {
  // 1. List Expenses with Search & Filters
  list: asyncHandler(async (req, res) => {
    const filter = {};
    const {
      search,
      department,
      category,
      status,
      paymentStatus,
      startDate,
      endDate,
    } = req.query;

    const st = status || paymentStatus;
    if (st && st !== 'All') {
      filter.paymentStatus = st;
    }

    if (department && department !== 'All') {
      filter.department = department;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = end;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { vendorName: { $regex: q, $options: 'i' } },
        { receiptNumber: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { employeeName: { $regex: q, $options: 'i' } },
      ];
    }

    const expenses = await Expense.find(filter)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('recordedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ expenseDate: -1, createdAt: -1 });

    res.json(successResponse(expenses, 'Expenses retrieved successfully'));
  }),

  // 2. Get Single Expense
  get: asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id)
      .populate('employee', 'firstName lastName email department designation')
      .populate('recordedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!expense) throw createNotFoundError('Expense record not found');
    res.json(successResponse(expense, 'Expense retrieved successfully'));
  }),

  // 3. Create Expense
  create: asyncHandler(async (req, res) => {
    const {
      title,
      category,
      department,
      amount,
      currency,
      expenseDate,
      paymentMethod,
      paymentStatus,
      vendorName,
      receiptNumber,
      receiptUrl,
      description,
      employeeId,
      employee: empRef,
      employeeName,
      tags,
    } = req.body;

    if (!title || !category || amount === undefined || amount === null) {
      throw createValidationError('Title, category, and valid amount are required');
    }

    const empId = employeeId || empRef;
    let resolvedName = employeeName || '';
    let resolvedDept = department || 'Finance';

    if (empId && mongoose.Types.ObjectId.isValid(empId)) {
      const empUser = await User.findById(empId).select('firstName lastName email personalInfo jobDetails department');
      if (empUser) {
        resolvedName =
          resolvedName ||
          empUser.personalInfo?.fullName ||
          [empUser.firstName, empUser.lastName].filter(Boolean).join(' ').trim() ||
          empUser.email;
        resolvedDept = resolvedDept || empUser.jobDetails?.department || empUser.department || 'Finance';
      }
    }

    const generatedReceipt = receiptNumber || `REC-${Date.now().toString().slice(-6)}`;

    const newExpense = await Expense.create({
      title: title.trim(),
      category: category.trim(),
      department: resolvedDept,
      amount: Number(amount) || 0,
      currency: currency || 'INR',
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      paymentStatus: paymentStatus || 'Pending',
      vendorName: vendorName ? vendorName.trim() : '',
      receiptNumber: generatedReceipt,
      receiptUrl: receiptUrl || '',
      description: description ? description.trim() : '',
      recordedBy: req.user?.userId || null,
      employee: empId && mongoose.Types.ObjectId.isValid(empId) ? empId : null,
      employeeName: resolvedName,
      tags: Array.isArray(tags) ? tags : [],
    });

    const populated = await Expense.findById(newExpense._id)
      .populate('employee', 'firstName lastName email department')
      .populate('recordedBy', 'firstName lastName email');

    res.status(201).json(createdResponse(populated, 'Expense created successfully in Atlas'));
  }),

  // 4. Update Expense
  update: asyncHandler(async (req, res) => {
    const existing = await Expense.findById(req.params.id);
    if (!existing) throw createNotFoundError('Expense record not found');

    const allowedUpdates = [
      'title',
      'category',
      'department',
      'amount',
      'currency',
      'expenseDate',
      'paymentMethod',
      'paymentStatus',
      'vendorName',
      'receiptNumber',
      'receiptUrl',
      'description',
      'employeeName',
      'tags',
    ];

    allowedUpdates.forEach((f) => {
      if (req.body[f] !== undefined) existing[f] = req.body[f];
    });

    if (req.body.employee && mongoose.Types.ObjectId.isValid(req.body.employee)) {
      existing.employee = req.body.employee;
    }

    await existing.save();

    const populated = await Expense.findById(existing._id)
      .populate('employee', 'firstName lastName email department')
      .populate('recordedBy', 'firstName lastName email');

    res.json(successResponse(populated, 'Expense updated successfully'));
  }),

  // 5. Approve Expense
  approve: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Finance can approve expenses');

    const existing = await Expense.findById(req.params.id);
    if (!existing) throw createNotFoundError('Expense record not found');

    existing.paymentStatus = 'Approved';
    existing.approvedBy = req.user?.userId || null;
    await existing.save();

    res.json(successResponse(existing, 'Expense approved successfully'));
  }),

  // 6. Reject Expense
  reject: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Finance can reject expenses');

    const existing = await Expense.findById(req.params.id);
    if (!existing) throw createNotFoundError('Expense record not found');

    existing.paymentStatus = 'Rejected';
    if (req.body.reason) {
      existing.description = existing.description
        ? `${existing.description} [Rejection Note: ${req.body.reason}]`
        : `Rejection Note: ${req.body.reason}`;
    }
    await existing.save();

    res.json(successResponse(existing, 'Expense rejected successfully'));
  }),

  // 7. Mark Expense as Paid
  pay: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Finance can mark expenses as paid');

    const existing = await Expense.findById(req.params.id);
    if (!existing) throw createNotFoundError('Expense record not found');

    existing.paymentStatus = 'Paid';
    if (req.body.paymentMethod) existing.paymentMethod = req.body.paymentMethod;
    await existing.save();

    res.json(successResponse(existing, 'Expense marked as Paid'));
  }),

  // 8. Delete Expense
  remove: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Finance can delete expenses');

    const existing = await Expense.findByIdAndDelete(req.params.id);
    if (!existing) throw createNotFoundError('Expense record not found');

    res.json(successResponse({ id: req.params.id }, 'Expense deleted successfully from Atlas'));
  }),
};

export default ExpenseController;
