import mongoose from 'mongoose';
import HRSupportRequest, {
  HR_SUPPORT_CATEGORIES,
  SENSITIVE_CATEGORIES,
  HR_SUPPORT_DEPARTMENTS,
} from '../models/HRSupportRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AccessAudit from '../models/AccessAudit.js';
import {
  createForbiddenError,
  createNotFoundError,
  createValidationError,
} from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper: Check if user has HR or Administrative privileges
const isHrOrAdmin = (user = {}) => {
  const role = String(user?.role || '').toLowerCase();
  const dept = String(user?.department || '').trim().toUpperCase();
  return ['admin', 'super_admin'].includes(role) || dept === 'HR';
};

// Helper: Audit Sensitive HR Data Access in AccessAudit collection
const logSensitiveAudit = async ({
  user,
  targetEmployee,
  action,
  sensitiveCategory = '',
  moduleName = 'HR Support',
  reason = '',
  result = 'SUCCESS',
  req,
}) => {
  try {
    const performedByName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.email ||
      'Authorized User';

    const empId =
      targetEmployee?.jobDetails?.employeeId ||
      targetEmployee?.employeeId ||
      '';
    const empName =
      targetEmployee?.personalInfo?.fullName ||
      [targetEmployee?.firstName, targetEmployee?.lastName].filter(Boolean).join(' ') ||
      targetEmployee?.employeeName ||
      'Employee';
    const empDept =
      targetEmployee?.jobDetails?.department ||
      targetEmployee?.department ||
      '';
    const empDesig =
      targetEmployee?.jobDetails?.designation ||
      targetEmployee?.designation ||
      '';

    await AccessAudit.create({
      employee: targetEmployee?._id || targetEmployee?.employee || user.userId,
      employeeName: empName,
      employeeId: empId,
      department: empDept,
      designation: empDesig,
      role: user?.role || 'employee',
      moduleKey: 'hr_support',
      moduleName,
      permission: 'manage',
      action,
      sensitiveCategory: sensitiveCategory || 'Sensitive HR Data',
      result,
      reason: reason || `Access to sensitive HR Support record (${action})`,
      performedBy: user?.userId || user?._id || null,
      performedByName,
      ipAddress: (req?.headers && (req.headers['x-forwarded-for'] || req.socket?.remoteAddress)) || '',
      userAgent: (req?.headers && req.headers['user-agent']) || '',
      date: new Date(),
    });
  } catch (err) {
    // Non-blocking for primary operation
    console.error('Failed to write sensitive audit log:', err.message);
  }
};

// Helper: Record audit / lifecycle history on the request document
const recordHistory = (request, action, details = '', previousValue = '', newValue = '', user = null) => {
  if (!request.history) request.history = [];
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'System';
  const userRole = user?.role || 'employee';

  request.history.unshift({
    action,
    details: String(details || ''),
    previousValue: String(previousValue || ''),
    newValue: String(newValue || ''),
    performedBy: user?.userId || user?._id || null,
    performedByName: userName,
    performedByRole: userRole,
    createdAt: new Date(),
  });
};

// Helper: Send in-app notification
const sendNotification = async (recipientId, title, message, type = 'Info') => {
  if (!recipientId) return;
  try {
    await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
    });
  } catch (err) {
    console.error('Failed to create in-app notification:', err.message);
  }
};

// Helper: Generate unique Request ID (HRS-YYYY-XXXXXX)
const generateRequestId = async () => {
  const year = new Date().getFullYear();
  let id = '';
  let exists = true;
  while (exists) {
    const rand = Math.floor(100000 + Math.random() * 900000);
    id = `HRS-${year}-${rand}`;
    exists = await HRSupportRequest.exists({ requestId: id });
  }
  return id;
};

// Recalculate reminder status based on date/time
const updateReminderStatusIfDue = (request) => {
  if (!request?.reminder?.enabled || !request.reminder.date) return;
  if (['Completed', 'Cancelled'].includes(request.reminder.status)) return;

  const remDate = new Date(request.reminder.date);
  const now = new Date();

  // If time string exists (e.g. "14:30"), parse into hours/minutes
  if (request.reminder.time && typeof request.reminder.time === 'string') {
    const parts = request.reminder.time.split(':');
    if (parts.length >= 2) {
      remDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    }
  }

  if (remDate <= now) {
    // If overdue by more than 24h
    const diffHours = (now - remDate) / (1000 * 60 * 60);
    if (diffHours >= 24) {
      request.reminder.status = 'Overdue';
    } else {
      request.reminder.status = 'Due';
    }
  } else {
    request.reminder.status = 'Scheduled';
  }
};

export const HRSupportController = {
  // 1. Categories & Master Data Listing
  getCategories: asyncHandler(async (_req, res) => {
    res.json(
      successResponse(
        {
          categories: HR_SUPPORT_CATEGORIES,
          sensitiveCategories: SENSITIVE_CATEGORIES,
          departments: HR_SUPPORT_DEPARTMENTS,
        },
        'HR Support master data retrieved'
      )
    );
  }),

  // 2. Active HR & Admin Staff for Assignment
  getHrStaff: asyncHandler(async (req, res) => {
    const hrUsers = await User.find({
      isActive: true,
      $or: [
        { role: { $in: ['admin', 'super_admin'] } },
        { department: { $regex: /^HR$/i } },
        { 'jobDetails.department': { $regex: /^HR$/i } },
      ],
    })
      .select('firstName lastName email department designation jobDetails')
      .sort({ firstName: 1 })
      .lean();

    const formatted = hrUsers.map((u) => ({
      _id: u._id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      email: u.email,
      department: u.jobDetails?.department || u.department || 'HR',
      designation: u.jobDetails?.designation || u.designation || 'HR Representative',
    }));

    res.json(successResponse(formatted, 'HR staff list retrieved'));
  }),

  // 3. Dynamic Real Atlas KPIs & Summary
  getSummary: asyncHandler(async (req, res) => {
    const isHR = isHrOrAdmin(req.user);
    const filter = {};

    // Non-HR employees only see their own metrics
    if (!isHR) {
      filter.employee = req.user.userId;
    }

    const requests = await HRSupportRequest.find(filter).lean();
    const now = new Date();

    let openCount = 0;
    let assignedCount = 0;
    let inProgressCount = 0;
    let pendingEmployeeCount = 0;
    let pendingInternalCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;
    let highPriorityCount = 0;
    let urgentCount = 0;
    let overdueCount = 0;
    let reminderDueCount = 0;
    let upcomingRemindersCount = 0;
    let grievancesCount = 0;

    for (const r of requests) {
      const isClosedOrResolved = ['Resolved', 'Closed'].includes(r.status);

      if (r.status === 'New') openCount++;
      if (r.status === 'Assigned') assignedCount++;
      if (r.status === 'In Progress') inProgressCount++;
      if (r.status === 'Pending Employee') pendingEmployeeCount++;
      if (r.status === 'Pending Internal') pendingInternalCount++;
      if (r.status === 'Resolved') resolvedCount++;
      if (r.status === 'Closed') closedCount++;

      if (!isClosedOrResolved) {
        if (r.priority === 'High') highPriorityCount++;
        if (r.priority === 'Urgent') urgentCount++;

        if (r.dueDate && new Date(r.dueDate) < now) {
          overdueCount++;
        }
      }

      if (SENSITIVE_CATEGORIES.includes(r.category)) {
        grievancesCount++;
      }

      if (r.reminder?.enabled) {
        if (['Due', 'Overdue'].includes(r.reminder.status)) {
          reminderDueCount++;
        } else if (r.reminder.status === 'Scheduled') {
          upcomingRemindersCount++;
        }
      }
    }

    const summary = {
      total: requests.length,
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      pendingEmployee: pendingEmployeeCount,
      pendingInternal: pendingInternalCount,
      resolved: resolvedCount,
      closed: closedCount,
      highPriority: highPriorityCount,
      urgent: urgentCount,
      overdue: overdueCount,
      reminderDue: reminderDueCount,
      upcomingReminders: upcomingRemindersCount,
      grievances: grievancesCount,
    };

    res.json(successResponse(summary, 'HR Support summary metrics computed'));
  }),

  // 4. List Requests with Multi-Filter, Search, & Field-Level Security
  list: asyncHandler(async (req, res) => {
    const isHR = isHrOrAdmin(req.user);
    const filter = {};

    // 1. Employee ownership check: non-HR users CAN ONLY see their own requests
    if (!isHR) {
      filter.employee = req.user.userId;
    } else {
      // HR filters
      if (req.query.employee) {
        filter.employee = req.query.employee;
      }
      if (req.query.assignedTo) {
        if (req.query.assignedTo === 'unassigned') {
          filter.assignedTo = null;
        } else if (req.query.assignedTo === 'me') {
          filter.assignedTo = req.user.userId;
        } else {
          filter.assignedTo = req.query.assignedTo;
        }
      }
    }

    // Common filters
    if (req.query.department && req.query.department !== 'All') {
      const dept = req.query.department;
      if (dept === 'IT' || dept === 'Tech') {
        filter.department = { $in: ['IT', 'Tech'] };
      } else if (dept === 'Video' || dept === 'Video Editor') {
        filter.department = { $in: ['Video', 'Video Editor'] };
      } else if (dept === 'Social Media' || dept === 'Digital Marketing') {
        filter.department = { $in: ['Social Media', 'Digital Marketing'] };
      } else {
        filter.department = dept;
      }
    }
    if (req.query.category && req.query.category !== 'All') {
      filter.category = req.query.category;
    }
    if (req.query.priority && req.query.priority !== 'All') {
      filter.priority = req.query.priority;
    }
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.query.reminderStatus && req.query.reminderStatus !== 'All') {
      filter['reminder.status'] = req.query.reminderStatus;
    }
    if (req.query.grievancesOnly === 'true') {
      filter.category = { $in: SENSITIVE_CATEGORIES };
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }

    // Overdue filter
    if (req.query.overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $nin: ['Resolved', 'Closed'] };
    }

    // Search query: searches Request ID, employee name, employee ID, and subject
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { requestId: regex },
        { subject: regex },
        { employeeName: regex },
        { employeeId: regex },
      ];
    }

    let query = HRSupportRequest.find(filter)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails employmentStatus')
      .populate('assignedTo', 'firstName lastName email department designation')
      .sort({ createdAt: -1 });

    // Strict field-level protection: strip internalNotes for non-HR employees
    if (!isHR) {
      query = query.select('-internalNotes');
    }

    const items = await query.lean();

    // Ensure reminder statuses are up to date
    for (const item of items) {
      updateReminderStatusIfDue(item);
    }

    res.json(successResponse(items, 'HR Support requests retrieved'));
  }),

  // 5. Employee Raises Request
  create: asyncHandler(async (req, res) => {
    const {
      category,
      otherCategory,
      subject,
      description,
      priority = 'Medium',
      reminderEnabled = false,
      reminderDate = null,
      reminderTime = '',
      reminderNote = '',
      attachments = [],
    } = req.body;

    if (!category) throw createValidationError('Category is required');
    if (!HR_SUPPORT_CATEGORIES.includes(category)) {
      throw createValidationError('Invalid HR Support category selected');
    }
    if (category === 'Other' && (!otherCategory || !otherCategory.trim())) {
      throw createValidationError('Please specify the other issue or category');
    }
    if (!subject || !subject.trim()) throw createValidationError('Subject is required');
    if (!description || !description.trim()) throw createValidationError('Detailed description is required');

    // Auto-populate logged-in employee details securely from database
    const employeeUser = await User.findById(req.user.userId).lean();
    if (!employeeUser) throw createNotFoundError('Employee record not found');

    const empName =
      employeeUser.personalInfo?.fullName ||
      [employeeUser.firstName, employeeUser.lastName].filter(Boolean).join(' ') ||
      employeeUser.email;
    const empId = employeeUser.jobDetails?.employeeId || '';
    const empDept = employeeUser.jobDetails?.department || employeeUser.department || 'General';
    const empDesig = employeeUser.jobDetails?.designation || employeeUser.designation || 'Employee';

    const uniqueRequestId = await generateRequestId();

    const newRequest = new HRSupportRequest({
      requestId: uniqueRequestId,
      employee: employeeUser._id,
      employeeName: empName,
      employeeId: empId,
      department: empDept,
      designation: empDesig,
      category,
      otherCategory: category === 'Other' ? otherCategory.trim() : '',
      subject: subject.trim(),
      description: description.trim(),
      priority,
      status: 'New',
      attachments: Array.isArray(attachments) ? attachments : [],
      createdBy: employeeUser._id,
      createdByName: empName,
      reminder: {
        enabled: Boolean(reminderEnabled),
        date: reminderDate ? new Date(reminderDate) : null,
        time: reminderTime || '',
        note: reminderNote || '',
        status: reminderEnabled ? 'Scheduled' : 'Scheduled',
        createdBy: employeeUser._id,
        createdByName: empName,
        createdAt: new Date(),
      },
    });

    recordHistory(
      newRequest,
      'Created',
      `Request raised by ${empName} with priority ${priority}`,
      '',
      'New',
      req.user
    );

    if (reminderEnabled) {
      recordHistory(
        newRequest,
        'Reminder Created',
        `Follow-up reminder set for ${reminderDate || 'scheduled date'}`,
        '',
        'Scheduled',
        req.user
      );
    }

    await newRequest.save();

    // Audit if category is sensitive
    if (SENSITIVE_CATEGORIES.includes(category)) {
      await logSensitiveAudit({
        user: req.user,
        targetEmployee: employeeUser,
        action: 'CREATE_SENSITIVE_HR_REQUEST',
        sensitiveCategory: category,
        reason: `Employee raised sensitive HR request ${uniqueRequestId} (${category})`,
        req,
      });
    }

    // In-app notification to HR Managers
    try {
      const hrAdmins = await User.find({
        isActive: true,
        $or: [{ role: { $in: ['admin', 'super_admin'] } }, { department: { $regex: /^HR$/i } }],
      })
        .select('_id')
        .lean();

      for (const admin of hrAdmins) {
        sendNotification(
          admin._id,
          'New HR Support Request',
          `New request [${uniqueRequestId}] raised by ${empName}: ${subject.trim()}`,
          'Info'
        );
      }
    } catch (e) { }

    res.status(201).json(createdResponse(newRequest, 'HR Support request submitted successfully'));
  }),

  // 6. View Request Details by ID (Case View)
  getById: asyncHandler(async (req, res) => {
    const isHR = isHrOrAdmin(req.user);
    const request = await HRSupportRequest.findById(req.params.id)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails employmentStatus')
      .populate('assignedTo', 'firstName lastName email department designation')
      .populate('assignedBy', 'firstName lastName email')
      .populate('resolution.resolvedBy', 'firstName lastName email')
      .populate('closure.closedBy', 'firstName lastName email')
      .populate('reopen.reopenedBy', 'firstName lastName email');

    if (!request) throw createNotFoundError('HR Support request not found');

    // 1. Employee ownership check: employee can ONLY view own request
    if (!isHR && String(request.employee._id || request.employee) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied. You can only view your own support requests.');
    }

    updateReminderStatusIfDue(request);

    // 2. Strict field-level security: strip internalNotes for non-HR employees
    const responseObj = request.toObject();
    if (!isHR) {
      delete responseObj.internalNotes;
      // Filter out internal note entries from history for non-HR
      if (Array.isArray(responseObj.history)) {
        responseObj.history = responseObj.history.filter((h) => h.action !== 'Internal Note Added');
      }
    } else {
      // 3. Sensitive HR Data Audit when HR views sensitive case
      if (SENSITIVE_CATEGORIES.includes(request.category)) {
        await logSensitiveAudit({
          user: req.user,
          targetEmployee: request.employee,
          action: 'VIEW_SENSITIVE_HR_RECORD',
          sensitiveCategory: request.category,
          reason: `HR accessed sensitive request ${request.requestId}`,
          req,
        });
      }
    }

    res.json(successResponse(responseObj, 'Request details retrieved'));
  }),

  // 7. Assign / Reassign / Unassign HR
  assign: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can assign requests.');
    }

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const { assignedTo, reason } = req.body;
    const previousAssigneeId = request.assignedTo;
    const previousAssigneeName = request.assignedToName || 'Unassigned';

    const hrUser = await User.findById(req.user.userId).lean();
    const assignedByName = [hrUser?.firstName, hrUser?.lastName].filter(Boolean).join(' ') || hrUser?.email || 'HR Admin';

    if (!assignedTo) {
      // Unassign
      request.assignedTo = null;
      request.assignedToName = '';
      request.assignedBy = null;
      request.assignedByName = '';
      request.assignedAt = null;

      recordHistory(
        request,
        'Unassigned',
        reason ? `Unassigned: ${reason}` : 'Request unassigned by HR',
        previousAssigneeName,
        'Unassigned',
        req.user
      );
    } else {
      // Assign or Reassign
      const targetUser = await User.findById(assignedTo).lean();
      if (!targetUser) throw createNotFoundError('Selected HR user does not exist');

      const targetName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || targetUser.email;

      request.assignedTo = targetUser._id;
      request.assignedToName = targetName;
      request.assignedBy = req.user.userId;
      request.assignedByName = assignedByName;
      request.assignedAt = new Date();

      if (request.status === 'New') {
        request.status = 'Assigned';
      }

      if (!request.reassignmentHistory) request.reassignmentHistory = [];
      request.reassignmentHistory.unshift({
        previousAssignee: previousAssigneeId,
        previousAssigneeName,
        newAssignee: targetUser._id,
        newAssigneeName: targetName,
        reassignedBy: req.user.userId,
        reassignedByName: assignedByName,
        reassignedAt: new Date(),
        reason: reason || 'Assigned by HR Admin',
      });

      const actionName = previousAssigneeId ? 'Reassigned' : 'Assigned';
      recordHistory(
        request,
        actionName,
        `Assigned to ${targetName}. Reason: ${reason || 'Direct Assignment'}`,
        previousAssigneeName,
        targetName,
        req.user
      );

      // In-app notifications
      sendNotification(
        targetUser._id,
        'HR Case Assigned to You',
        `Case [${request.requestId}] has been assigned to you by ${assignedByName}.`,
        'Info'
      );
      sendNotification(
        request.employee,
        'HR Representative Assigned',
        `Your HR request [${request.requestId}] has been assigned to ${targetName}.`,
        'Info'
      );
    }

    await request.save();
    res.json(successResponse(request, 'Request assignment updated successfully'));
  }),

  // 8. Update Request Priority
  updatePriority: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can update priority.');
    }

    const { priority, reason } = req.body;
    if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      throw createValidationError('Invalid priority value');
    }

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const previousPriority = request.priority;
    request.priority = priority;

    recordHistory(
      request,
      'Priority Changed',
      reason ? `Priority updated: ${reason}` : `Priority changed to ${priority}`,
      previousPriority,
      priority,
      req.user
    );

    await request.save();
    res.json(successResponse(request, `Priority updated to ${priority}`));
  }),

  // 9. Update Request Status Workflow
  updateStatus: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can update status.');
    }

    const { status, remarks } = req.body;
    const allowed = [
      'New',
      'Assigned',
      'In Progress',
      'Pending Employee',
      'Pending Internal',
      'Resolved',
      'Closed',
      'Reopened',
    ];
    if (!allowed.includes(status)) {
      throw createValidationError('Invalid status value');
    }

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const previousStatus = request.status;
    request.status = status;

    recordHistory(
      request,
      'Status Changed',
      remarks ? `Status changed to ${status}. Note: ${remarks}` : `Status changed to ${status}`,
      previousStatus,
      status,
      req.user
    );

    // Notify employee of status change
    sendNotification(
      request.employee,
      'HR Request Status Updated',
      `Your request [${request.requestId}] status has changed to "${status}".`,
      status === 'Resolved' ? 'Success' : 'Info'
    );

    await request.save();
    res.json(successResponse(request, `Status updated to ${status}`));
  }),

  // 10. Threaded Communication (Employee & HR Responses)
  addResponse: asyncHandler(async (req, res) => {
    const { message, attachments = [] } = req.body;
    if (!message || !message.trim()) {
      throw createValidationError('Response message cannot be empty');
    }

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const isHR = isHrOrAdmin(req.user);
    const isOwner = String(request.employee) === String(req.user.userId);

    if (!isHR && !isOwner) {
      throw createForbiddenError('Access denied. You can only respond to your own requests.');
    }

    const userRecord = await User.findById(req.user.userId).lean();
    const senderName = [userRecord?.firstName, userRecord?.lastName].filter(Boolean).join(' ') || userRecord?.email;
    const senderRole = isHR ? 'hr' : 'employee';

    const newMsg = {
      sender: req.user.userId,
      senderName,
      senderRole,
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date(),
    };

    if (!request.conversation) request.conversation = [];
    request.conversation.push(newMsg);

    // Automatic status progression on conversation reply
    if (isOwner && request.status === 'Pending Employee') {
      const prev = request.status;
      request.status = 'In Progress';
      recordHistory(request, 'Status Changed', 'Auto-updated to In Progress upon employee response', prev, 'In Progress', req.user);
    }

    recordHistory(
      request,
      isHR ? 'HR Response' : 'Employee Response',
      `${senderName} posted a response: "${message.trim().slice(0, 80)}..."`,
      '',
      '',
      req.user
    );

    await request.save();

    // Notify counterpart
    if (isOwner) {
      if (request.assignedTo) {
        sendNotification(
          request.assignedTo,
          'Employee Responded',
          `${senderName} replied on case [${request.requestId}].`,
          'Info'
        );
      }
    } else {
      sendNotification(
        request.employee,
        'HR Response Received',
        `${senderName} replied to your request [${request.requestId}].`,
        'Info'
      );
    }

    res.json(successResponse(request.conversation, 'Response added successfully'));
  }),

  // 11. Add Confidential Internal HR Note (HR & Admin ONLY)
  addInternalNote: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Internal notes are restricted to HR and Administrators.');
    }

    const { note } = req.body;
    if (!note || !note.trim()) throw createValidationError('Note content is required');

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const hrUser = await User.findById(req.user.userId).lean();
    const authorName = [hrUser?.firstName, hrUser?.lastName].filter(Boolean).join(' ') || hrUser?.email || 'HR Representative';

    const newNote = {
      author: req.user.userId,
      authorName,
      authorRole: req.user.role || 'hr',
      note: note.trim(),
      createdAt: new Date(),
    };

    if (!request.internalNotes) request.internalNotes = [];
    request.internalNotes.push(newNote);

    recordHistory(
      request,
      'Internal Note Added',
      `Confidential internal note added by ${authorName}`,
      '',
      '',
      req.user
    );

    // Audit creation of internal note
    await logSensitiveAudit({
      user: req.user,
      targetEmployee: request.employee,
      action: 'ADD_INTERNAL_HR_NOTE',
      sensitiveCategory: 'Internal HR Notes',
      reason: `Internal HR note added on case ${request.requestId}`,
      req,
    });

    await request.save();
    res.json(successResponse(request.internalNotes, 'Internal note added successfully'));
  }),

  // 12. Manage Reminders (Create, Reschedule, Complete, Cancel)
  manageReminder: asyncHandler(async (req, res) => {
    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const isHR = isHrOrAdmin(req.user);
    const isOwner = String(request.employee) === String(req.user.userId);

    if (!isHR && !isOwner) {
      throw createForbiddenError('Access denied. You cannot manage reminders on this request.');
    }

    const { action, date, time, note } = req.body;
    const userRecord = await User.findById(req.user.userId).lean();
    const userName = [userRecord?.firstName, userRecord?.lastName].filter(Boolean).join(' ') || userRecord?.email;

    if (!request.reminder) {
      request.reminder = { enabled: false, status: 'Scheduled' };
    }

    if (action === 'create' || action === 'update') {
      if (!date) throw createValidationError('Reminder date is required');
      request.reminder.enabled = true;
      request.reminder.date = new Date(date);
      request.reminder.time = time || '';
      request.reminder.note = note || '';
      request.reminder.status = 'Scheduled';
      request.reminder.createdBy = req.user.userId;
      request.reminder.createdByName = userName;
      request.reminder.createdAt = new Date();
      request.reminder.completedAt = null;
      request.reminder.cancelledAt = null;

      recordHistory(
        request,
        action === 'create' ? 'Reminder Created' : 'Reminder Updated',
        `Follow-up reminder set for ${new Date(date).toLocaleDateString()} ${time || ''}. Note: ${note || ''}`,
        '',
        'Scheduled',
        req.user
      );
    } else if (action === 'complete') {
      request.reminder.status = 'Completed';
      request.reminder.completedAt = new Date();

      recordHistory(
        request,
        'Reminder Completed',
        `Reminder marked completed by ${userName}`,
        'Scheduled',
        'Completed',
        req.user
      );
    } else if (action === 'cancel') {
      request.reminder.status = 'Cancelled';
      request.reminder.cancelledAt = new Date();

      recordHistory(
        request,
        'Reminder Cancelled',
        `Reminder cancelled by ${userName}`,
        'Scheduled',
        'Cancelled',
        req.user
      );
    } else {
      throw createValidationError('Invalid reminder action. Must be create, update, complete, or cancel.');
    }

    await request.save();
    res.json(successResponse(request.reminder, `Reminder ${action}d successfully`));
  }),

  // 13. Set / Update SLA Due Date
  updateDueDate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can update due dates.');
    }

    const { dueDate } = req.body;
    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const previousDueDate = request.dueDate ? new Date(request.dueDate).toLocaleDateString() : 'None';
    request.dueDate = dueDate ? new Date(dueDate) : null;
    const newDueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'None';

    recordHistory(
      request,
      'Due Date Updated',
      `SLA Due date updated to ${newDueDateStr}`,
      previousDueDate,
      newDueDateStr,
      req.user
    );

    await request.save();
    res.json(successResponse(request, `Due date updated to ${newDueDateStr}`));
  }),

  // 14. Resolve Request
  resolve: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can resolve requests.');
    }

    const { resolutionDetails } = req.body;
    if (!resolutionDetails || !resolutionDetails.trim()) {
      throw createValidationError('Resolution details are required to resolve the request');
    }

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const hrUser = await User.findById(req.user.userId).lean();
    const resolvedByName = [hrUser?.firstName, hrUser?.lastName].filter(Boolean).join(' ') || hrUser?.email;

    const previousStatus = request.status;
    request.status = 'Resolved';
    request.resolution = {
      details: resolutionDetails.trim(),
      resolvedBy: req.user.userId,
      resolvedByName,
      resolvedAt: new Date(),
    };

    recordHistory(
      request,
      'Resolved',
      `Request resolved by ${resolvedByName}: ${resolutionDetails.trim()}`,
      previousStatus,
      'Resolved',
      req.user
    );

    sendNotification(
      request.employee,
      'HR Support Request Resolved',
      `Your request [${request.requestId}] has been resolved by HR.`,
      'Success'
    );

    await request.save();
    res.json(successResponse(request, 'Request marked as Resolved'));
  }),

  // 15. Close Request
  close: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR or Administrators can close requests.');
    }

    const { closureDetails } = req.body;
    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const hrUser = await User.findById(req.user.userId).lean();
    const closedByName = [hrUser?.firstName, hrUser?.lastName].filter(Boolean).join(' ') || hrUser?.email;

    const previousStatus = request.status;
    request.status = 'Closed';
    request.closure = {
      details: closureDetails ? closureDetails.trim() : 'Case closed by HR',
      closedBy: req.user.userId,
      closedByName,
      closedAt: new Date(),
    };

    recordHistory(
      request,
      'Closed',
      `Case closed by ${closedByName}. Remarks: ${closureDetails || 'None'}`,
      previousStatus,
      'Closed',
      req.user
    );

    sendNotification(
      request.employee,
      'HR Support Request Closed',
      `Your request [${request.requestId}] has been closed.`,
      'Info'
    );

    await request.save();
    res.json(successResponse(request, 'Request closed successfully'));
  }),

  // 16. Reopen Request
  reopen: asyncHandler(async (req, res) => {
    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const isHR = isHrOrAdmin(req.user);
    const isOwner = String(request.employee) === String(req.user.userId);

    if (!isHR && !isOwner) {
      throw createForbiddenError('Access denied. You cannot reopen this request.');
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      throw createValidationError('Reason for reopening is required');
    }

    const userRecord = await User.findById(req.user.userId).lean();
    const reopenedByName = [userRecord?.firstName, userRecord?.lastName].filter(Boolean).join(' ') || userRecord?.email;

    const previousStatus = request.status;
    request.status = 'Reopened';
    request.reopen = {
      reason: reason.trim(),
      reopenedBy: req.user.userId,
      reopenedByName,
      reopenedAt: new Date(),
    };

    recordHistory(
      request,
      'Reopened',
      `Request reopened by ${reopenedByName}. Reason: ${reason.trim()}`,
      previousStatus,
      'Reopened',
      req.user
    );

    if (request.assignedTo) {
      sendNotification(
        request.assignedTo,
        'HR Request Reopened',
        `Case [${request.requestId}] has been reopened by ${reopenedByName}.`,
        'Warning'
      );
    }

    await request.save();
    res.json(successResponse(request, 'Request reopened successfully'));
  }),

  // 17. Upload File Attachment to Request
  uploadAttachment: asyncHandler(async (req, res) => {
    if (!req.file) throw createValidationError('No file was uploaded');

    const request = await HRSupportRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('HR Support request not found');

    const isHR = isHrOrAdmin(req.user);
    const isOwner = String(request.employee) === String(req.user.userId);

    if (!isHR && !isOwner) {
      throw createForbiddenError('Access denied. You cannot upload attachments to this request.');
    }

    const userRecord = await User.findById(req.user.userId).lean();
    const uploaderName = [userRecord?.firstName, userRecord?.lastName].filter(Boolean).join(' ') || userRecord?.email;

    const attachment = {
      name: req.file.originalname,
      url: `/uploads/documents/${req.file.filename}`,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user.userId,
      uploadedByName: uploaderName,
    };

    if (!request.attachments) request.attachments = [];
    request.attachments.push(attachment);

    recordHistory(
      request,
      'Attachment Uploaded',
      `File "${req.file.originalname}" uploaded by ${uploaderName}`,
      '',
      req.file.originalname,
      req.user
    );

    await request.save();
    res.json(successResponse(attachment, 'Attachment uploaded successfully'));
  }),

  // 18. HR Reports & Insights (Database Aggregation)
  getReports: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied. Only HR and Administrators can view reports.');
    }

    const [byCategory, byStatus, byPriority, byDepartment, byAssignee, totalResolved, totalOverdue] =
      await Promise.all([
        HRSupportRequest.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        HRSupportRequest.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        HRSupportRequest.aggregate([
          { $group: { _id: '$priority', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        HRSupportRequest.aggregate([
          { $group: { _id: '$department', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        HRSupportRequest.aggregate([
          { $match: { assignedToName: { $ne: '' } } },
          { $group: { _id: '$assignedToName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        HRSupportRequest.countDocuments({ status: { $in: ['Resolved', 'Closed'] } }),
        HRSupportRequest.countDocuments({
          dueDate: { $lt: new Date() },
          status: { $nin: ['Resolved', 'Closed'] },
        }),
      ]);

    res.json(
      successResponse(
        {
          byCategory,
          byStatus,
          byPriority,
          byDepartment,
          byAssignee,
          totalResolved,
          totalOverdue,
        },
        'HR Support reports generated successfully'
      )
    );
  }),
};

export default HRSupportController;
