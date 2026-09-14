import mongoose from 'mongoose';
import Resignation from '../models/Resignation.js';
import User from '../models/User.js';
import Document from '../models/Document.js';
import Asset from '../models/Asset.js';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import EmployeeHistory from '../models/EmployeeHistory.js';
import { calculateEmployeeFigures, toEmployeeSnapshot } from '../services/FullAndFinalSettlementService.js';
import Notification from '../models/Notification.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const createSystemNotification = async (recipientId, title, message, type = 'Info') => {
  try {
    if (recipientId) {
      await Notification.create({
        recipient: recipientId,
        title,
        message,
        type,
      });
    }
  } catch (err) {
    // Non-blocking notification
  }
};

const recordAudit = (record, action, previousValue = '', newValue = '', reason = '', user = null) => {
  if (!record.auditTrail) record.auditTrail = [];
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'HR Team';
  record.auditTrail.unshift({
    action,
    previousValue: String(previousValue || ''),
    newValue: String(newValue || ''),
    reason: String(reason || ''),
    performedBy: user?.userId || user?._id || null,
    performedByName: userName,
    date: new Date(),
  });
};

export const ResignationController = {
  // 1. Dynamic Real KPIs from Atlas
  summary: asyncHandler(async (_req, res) => {
    const resignations = await Resignation.find().lean();

    const pendingResignations = resignations.filter((r) => r.status === 'Submitted').length;
    const underReview = resignations.filter((r) => r.status === 'Under Review').length;
    const approved = resignations.filter((r) => r.status === 'Approved').length;
    const servingNotice = resignations.filter((r) => ['Approved', 'Notice Period', 'Offboarding', 'Exit Clearance'].includes(r.status)).length;
    const activeOffboarding = resignations.filter((r) => r.status === 'Offboarding' || r.offboarding?.status === 'In Progress').length;
    const pendingClearance = resignations.filter((r) => {
      if (['Rejected', 'Completed'].includes(r.status)) return false;
      const clr = r.clearance || {};
      return clr.hr?.status !== 'Completed' || clr.manager?.status !== 'Completed' || clr.finance?.status !== 'Completed' || clr.itAssets?.status !== 'Completed' || clr.knowledgeTransfer?.status !== 'Completed';
    }).length;
    const settlementDue = resignations.filter((r) => {
      if (['Rejected', 'Completed'].includes(r.status)) return false;
      return r.clearance?.finance?.settlementStatus !== 'Completed';
    }).length;
    const exitCompleted = resignations.filter((r) => r.status === 'Completed').length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const exitThisMonth = resignations.filter((r) => {
      if (r.status === 'Rejected') return false;
      const targetDate = r.approvedLastWorkingDay ? new Date(r.approvedLastWorkingDay) : new Date(r.proposedLastWorkingDay);
      return targetDate && targetDate.getMonth() === currentMonth && targetDate.getFullYear() === currentYear;
    }).length;

    res.json(
      successResponse(
        {
          pendingResignations,
          underReview,
          approved,
          servingNotice,
          activeOffboarding,
          pendingClearance,
          settlementDue,
          exitThisMonth,
          exitCompleted,
          total: resignations.length,
        },
        'Resignation summary computed'
      )
    );
  }),

  // 2. List Resignations
  list: asyncHandler(async (req, res) => {
    const filter = {};
    if (!isHrOrAdmin(req.user)) {
      filter.user = req.user.userId;
    } else if (req.query.user) {
      filter.user = req.query.user;
    }

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    let resignations = await Resignation.find(filter)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails salaryDetails employmentStatus accessStatus isActive')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('exitCompletedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.department && req.query.department !== 'All') {
      resignations = resignations.filter((r) => {
        const d = r.user?.jobDetails?.department || r.user?.department;
        return d === req.query.department;
      });
    }

    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      resignations = resignations.filter((r) => {
        const name = (r.user?.personalInfo?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`).toLowerCase();
        const email = (r.user?.email || '').toLowerCase();
        const empId = (r.user?.jobDetails?.employeeId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || empId.includes(q);
      });
    }

    res.json(successResponse(resignations, 'Resignation records retrieved'));
  }),

  // 3. Employee Submits Resignation
  create: asyncHandler(async (req, res) => {
    const targetUserId = req.body.userId && isHrOrAdmin(req.user) ? req.body.userId : req.user.userId;
    const { resignationDate, proposedLastWorkingDay, reason, employeeComments } = req.body;

    if (!proposedLastWorkingDay || !reason) {
      throw createValidationError('Proposed last working day and reason are required');
    }

    const regDate = resignationDate ? new Date(resignationDate) : new Date();
    const lwdDate = new Date(proposedLastWorkingDay);

    if (lwdDate < regDate) {
      throw createValidationError('Proposed last working day cannot be earlier than resignation date');
    }

    // Check for existing active resignation
    const existingActive = await Resignation.findOne({
      user: targetUserId,
      status: { $nin: ['Rejected', 'Completed'] },
    });

    if (existingActive) {
      throw createValidationError(
        `An active resignation request (${existingActive.status}) is already submitted.`
      );
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw createNotFoundError('Employee not found');

    const diffMs = lwdDate.getTime() - regDate.getTime();
    const noticeDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const actorName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || targetUser.email;

    const resignation = new Resignation({
      user: targetUserId,
      resignationDate: regDate,
      proposedLastWorkingDay: lwdDate,
      approvedLastWorkingDay: lwdDate,
      noticePeriodDays: noticeDays,
      reason: reason.trim(),
      employeeComments: employeeComments ? employeeComments.trim() : '',
      status: 'Submitted',
      accessManagement: {
        crmAccess: 'Active',
        emailAccess: 'Active',
        notes: 'Initial resignation submission',
      },
    });

    recordAudit(resignation, 'Resignation Submitted', '', 'Submitted', reason.trim(), req.user);
    await resignation.save();

    // Notify HR
    const hrUsers = await User.find({ department: 'HR', role: 'employee' }).select('_id');
    for (const hr of hrUsers) {
      await createSystemNotification(
        hr._id,
        'New Resignation Request',
        `${actorName} has submitted a resignation request.`,
        'Warning'
      );
    }

    const populated = await Resignation.findById(resignation._id).populate(
      'user',
      'firstName lastName email department designation personalInfo jobDetails salaryDetails'
    );

    res.status(201).json(createdResponse(populated, 'Resignation submitted successfully'));
  }),

  // 4. Get Single Resignation
  get: asyncHandler(async (req, res) => {
    const record = await Resignation.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails salaryDetails employmentStatus accessStatus isActive createdAt')
      .populate('reviewedBy', 'firstName lastName email department')
      .populate('exitCompletedBy', 'firstName lastName email department');

    if (!record) throw createNotFoundError('Resignation record not found');

    if (!isHrOrAdmin(req.user) && String(record.user._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    res.json(successResponse(record, 'Resignation details retrieved'));
  }),

  // 5. HR Review
  review: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (['Rejected', 'Completed'].includes(record.status)) {
      throw createValidationError(`Cannot review a resignation that is already ${record.status}`);
    }

    const { hrRemarks } = req.body;
    const oldStatus = record.status;
    record.status = 'Under Review';
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();
    if (hrRemarks) record.hrRemarks = hrRemarks.trim();

    recordAudit(record, 'Under Review', oldStatus, 'Under Review', hrRemarks || 'Under review by HR', req.user);
    await record.save();

    res.json(successResponse(record, 'Resignation marked as Under Review'));
  }),

  // 6. HR Approve
  approve: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Rejected') {
      throw createValidationError('Cannot approve a rejected resignation');
    }

    const { approvedLastWorkingDay, noticePeriodDays, hrRemarks } = req.body;
    const oldStatus = record.status;

    if (approvedLastWorkingDay) {
      record.approvedLastWorkingDay = new Date(approvedLastWorkingDay);
    } else if (!record.approvedLastWorkingDay) {
      record.approvedLastWorkingDay = record.proposedLastWorkingDay;
    }

    if (noticePeriodDays !== undefined) {
      record.noticePeriodDays = Number(noticePeriodDays);
    }

    record.status = 'Notice Period';
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();
    if (hrRemarks) record.hrRemarks = hrRemarks.trim();

    recordAudit(
      record,
      'Resignation Approved',
      oldStatus,
      'Notice Period',
      `Approved with LWD: ${new Date(record.approvedLastWorkingDay).toISOString().slice(0, 10)}. ${hrRemarks || ''}`,
      req.user
    );

    await record.save();

    // Update User employment status to Notice Period
    await User.findByIdAndUpdate(record.user, { employmentStatus: 'Notice Period' });

    // Record EmployeeHistory lifecycle transition (with duplicate prevention)
    try {
      const existingHistory = await EmployeeHistory.findOne({
        employee: record.user,
        changeType: 'Status Change',
        newStatus: 'Notice Period',
      });
      if (!existingHistory) {
        const empUser = await User.findById(record.user).select('firstName lastName personalInfo jobDetails department designation employmentStatus');
        const empName = empUser?.personalInfo?.fullName || [empUser?.firstName, empUser?.lastName].filter(Boolean).join(' ').trim() || 'Employee';
        const empId = empUser?.jobDetails?.employeeId || String(empUser?._id || '');
        const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Manager';

        await EmployeeHistory.create({
          employee: record.user,
          employeeName: empName,
          employeeId: empId,
          changeType: 'Status Change',
          action: 'Resignation Approved - Notice Period',
          previousDepartment: empUser?.department || empUser?.jobDetails?.department || '',
          newDepartment: empUser?.department || empUser?.jobDetails?.department || '',
          previousDesignation: empUser?.designation || empUser?.jobDetails?.designation || '',
          newDesignation: empUser?.designation || empUser?.jobDetails?.designation || '',
          previousStatus: empUser?.employmentStatus || 'Active',
          newStatus: 'Notice Period',
          effectiveDate: record.approvedLastWorkingDay || new Date(),
          reason: record.reason || hrRemarks || 'Resignation approved by HR',
          remarks: `Notice period: ${record.noticePeriodDays || 30} days. Approved LWD: ${new Date(record.approvedLastWorkingDay).toLocaleDateString()}`,
          performedBy: req.user.userId,
          performedByName: hrName,
        });
      }
    } catch (histErr) {
      console.error('Error logging employee history for resignation approval:', histErr);
    }

    // Notify employee
    await createSystemNotification(
      record.user,
      'Resignation Approved',
      `Your resignation has been approved. Your official Last Working Day is ${new Date(record.approvedLastWorkingDay).toLocaleDateString()}.`,
      'Success'
    );

    res.json(successResponse(record, 'Resignation approved and Notice Period started'));
  }),

  // 7. HR Reject
  reject: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Completed') {
      throw createValidationError('Cannot reject an exit that is already completed');
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason) throw createValidationError('Rejection reason is required');

    const oldStatus = record.status;
    record.status = 'Rejected';
    record.rejectionReason = rejectionReason.trim();
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();

    recordAudit(record, 'Resignation Rejected', oldStatus, 'Rejected', rejectionReason.trim(), req.user);
    await record.save();

    // Revert user employment status to Active
    await User.findByIdAndUpdate(record.user, { employmentStatus: 'Active' });

    // Notify employee
    await createSystemNotification(
      record.user,
      'Resignation Request Update',
      `Your resignation request was rejected. Reason: ${rejectionReason.trim()}`,
      'Error'
    );

    res.json(successResponse(record, 'Resignation rejected'));
  }),

  // 8. Update Notice Period / Change LWD
  updateNoticePeriod: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const {
      resignationDate,
      approvedLastWorkingDay,
      noticePeriodDays,
      noticeStatus,
      earlyReleaseStatus,
      earlyReleaseDate,
      waiverDays,
      waiverRemarks,
    } = req.body;
    const oldLwd = record.approvedLastWorkingDay || record.proposedLastWorkingDay;

    if (resignationDate) record.resignationDate = new Date(resignationDate);
    if (approvedLastWorkingDay) record.approvedLastWorkingDay = new Date(approvedLastWorkingDay);
    if (noticePeriodDays !== undefined) record.noticePeriodDays = Number(noticePeriodDays);
    if (noticeStatus) record.noticeStatus = noticeStatus;
    if (earlyReleaseStatus) record.earlyReleaseStatus = earlyReleaseStatus;
    if (earlyReleaseDate) record.earlyReleaseDate = new Date(earlyReleaseDate);
    if (waiverDays !== undefined) record.waiverDays = Number(waiverDays);
    if (waiverRemarks) record.waiverRemarks = waiverRemarks.trim();

    recordAudit(
      record,
      'Notice Period / LWD Updated',
      oldLwd ? new Date(oldLwd).toISOString().slice(0, 10) : 'N/A',
      record.approvedLastWorkingDay ? new Date(record.approvedLastWorkingDay).toISOString().slice(0, 10) : 'N/A',
      `Notice period days: ${record.noticePeriodDays}, Status: ${record.noticeStatus || 'Active'}`,
      req.user
    );

    await record.save();
    res.json(successResponse(record, 'Notice period details updated successfully'));
  }),

  // 9. Update Clearance Item
  updateClearance: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { departmentKey, status, remarks, settlementAmount, settlementStatus } = req.body;

    if (!['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].includes(departmentKey)) {
      throw createValidationError('Invalid clearance department key');
    }

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';

    if (!record.clearance[departmentKey]) {
      record.clearance[departmentKey] = { status: 'Pending' };
    }

    const oldClearanceStatus = record.clearance[departmentKey].status;
    record.clearance[departmentKey].status = status || record.clearance[departmentKey].status;
    record.clearance[departmentKey].completedBy = hrName;
    record.clearance[departmentKey].completedDate = status === 'Completed' ? new Date() : null;
    if (remarks !== undefined) record.clearance[departmentKey].remarks = remarks;
    if (settlementAmount !== undefined) record.clearance[departmentKey].settlementAmount = Number(settlementAmount);
    if (settlementStatus !== undefined) record.clearance[departmentKey].settlementStatus = settlementStatus;

    if (record.status === 'Approved' || record.status === 'Notice Period') {
      record.status = 'Exit Clearance';
    }

    recordAudit(
      record,
      `${departmentKey.toUpperCase()} Clearance Updated`,
      oldClearanceStatus,
      status || oldClearanceStatus,
      remarks || 'Department clearance status update',
      req.user
    );

    await record.save();
    res.json(successResponse(record, `${departmentKey} clearance updated`));
  }),

  // 10. Start Offboarding Workflow
  startOffboarding: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';
    const oldStatus = record.status;
    record.status = 'Offboarding';
    record.offboarding = {
      status: 'In Progress',
      startedAt: new Date(),
      startedBy: req.user.userId,
      assignedHr: req.user.userId,
      assignedHrName: hrName,
      notes: req.body.notes || 'Formal employee offboarding initiated',
    };

    recordAudit(record, 'Offboarding Initiated', oldStatus, 'Offboarding', record.offboarding.notes, req.user);
    await record.save();

    res.json(successResponse(record, 'Offboarding workflow initiated successfully'));
  }),

  // 11. Record / Schedule Exit Interview
  submitExitInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const {
      status = 'Completed',
      scheduledDate,
      interviewerName,
      reasonForLeaving,
      managementFeedback,
      suggestions,
      rehireEligibility,
      hrComments,
    } = req.body;

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';
    const prevStatus = record.exitInterview?.status || 'Pending';

    record.exitInterview = {
      status,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : (record.exitInterview?.scheduledDate || null),
      interviewerName: interviewerName || record.exitInterview?.interviewerName || hrName,
      reasonForLeaving: reasonForLeaving !== undefined ? reasonForLeaving : (record.exitInterview?.reasonForLeaving || ''),
      managementFeedback: managementFeedback !== undefined ? managementFeedback : (record.exitInterview?.managementFeedback || ''),
      suggestions: suggestions !== undefined ? suggestions : (record.exitInterview?.suggestions || ''),
      rehireEligibility: rehireEligibility === 'Not Eligible' ? 'Not Eligible' : 'Eligible',
      hrComments: hrComments !== undefined ? hrComments : (record.exitInterview?.hrComments || ''),
      submittedAt: status === 'Completed' ? new Date() : (record.exitInterview?.submittedAt || null),
    };

    recordAudit(
      record,
      status === 'Scheduled' ? 'Exit Interview Scheduled' : 'Exit Interview Recorded',
      prevStatus,
      status,
      reasonForLeaving || `Exit interview marked ${status}`,
      req.user
    );

    await record.save();
    res.json(successResponse(record, `Exit interview ${status.toLowerCase()} successfully`));
  }),

  // 11. Complete Exit
  completeExit: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Completed') {
      throw createValidationError('Exit is already completed for this employee');
    }

    record.status = 'Completed';
    record.exitCompletedAt = new Date();
    record.exitCompletedBy = req.user.userId;

    if (!record.accessManagement) {
      record.accessManagement = { crmAccess: 'Revoked', emailAccess: 'Revoked' };
    } else {
      record.accessManagement.crmAccess = 'Revoked';
      record.accessManagement.emailAccess = 'Revoked';
      record.accessManagement.updatedAt = new Date();
      record.accessManagement.updatedBy = req.user.userId;
      record.accessManagement.updatedByName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';
    }

    recordAudit(record, 'Exit Completed', 'Exit Clearance', 'Completed', 'Exit formalities finalized. Account access revoked.', req.user);
    await record.save();

    // Mark Employee in users collection as Exited with full deactivation
    await User.findByIdAndUpdate(record.user, {
      employmentStatus: 'Exited',
      accessStatus: 'Revoked',
      isActive: false,
      exitDate: new Date(),
    });

    // Record EmployeeHistory lifecycle transition (with duplicate prevention)
    try {
      const existingExitHistory = await EmployeeHistory.findOne({
        employee: record.user,
        changeType: 'Status Change',
        newStatus: 'Exited',
      });
      if (!existingExitHistory) {
        const empUser = await User.findById(record.user).select('firstName lastName personalInfo jobDetails department designation employmentStatus');
        const empName = empUser?.personalInfo?.fullName || [empUser?.firstName, empUser?.lastName].filter(Boolean).join(' ').trim() || 'Employee';
        const empId = empUser?.jobDetails?.employeeId || String(empUser?._id || '');
        const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Manager';

        await EmployeeHistory.create({
          employee: record.user,
          employeeName: empName,
          employeeId: empId,
          changeType: 'Status Change',
          action: 'Exit Formalities Completed',
          previousDepartment: empUser?.department || empUser?.jobDetails?.department || '',
          newDepartment: empUser?.department || empUser?.jobDetails?.department || '',
          previousDesignation: empUser?.designation || empUser?.jobDetails?.designation || '',
          newDesignation: empUser?.designation || empUser?.jobDetails?.designation || '',
          previousStatus: empUser?.employmentStatus || 'Notice Period',
          newStatus: 'Exited',
          effectiveDate: new Date(),
          reason: record.reason || 'Exit formalities completed and access revoked',
          remarks: 'Employee offboarded successfully. Access revoked.',
          performedBy: req.user.userId,
          performedByName: hrName,
        });
      }
    } catch (histErr) {
      console.error('Error logging employee history for exit completion:', histErr);
    }

    // Notify employee
    await createSystemNotification(
      record.user,
      'Exit Formalities Completed',
      'Your exit formalities and final settlement have been successfully finalized. All the best for your future endeavors!',
      'Success'
    );

    res.json(successResponse(record, 'Employee exit completed successfully'));
  }),

  // 12. Terminate Employee (STRICTLY PRESERVED EXISTING FUNCTIONALITY)
  terminateEmployee: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { userId, effectiveDate, terminationReason, comments } = req.body;

    if (!userId || !terminationReason) {
      throw createValidationError('Employee selection and termination reason are required');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) throw createNotFoundError('Employee not found');

    const termDate = effectiveDate ? new Date(effectiveDate) : new Date();

    // Update User record in MongoDB users collection
    targetUser.employmentStatus = 'Terminated';
    targetUser.accessStatus = 'Revoked';
    targetUser.isActive = false;
    targetUser.exitDate = termDate;
    targetUser.terminationReason = terminationReason.trim();
    targetUser.terminationDate = termDate;
    targetUser.terminationComments = comments ? comments.trim() : '';
    await targetUser.save();

    // Record EmployeeHistory lifecycle transition (with duplicate prevention)
    try {
      const existingTermHistory = await EmployeeHistory.findOne({
        employee: targetUser._id,
        changeType: 'Status Change',
        newStatus: 'Terminated',
      });
      if (!existingTermHistory) {
        const empName = targetUser.personalInfo?.fullName || [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ').trim() || 'Employee';
        const empId = targetUser.jobDetails?.employeeId || String(targetUser._id || '');
        const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Manager';

        await EmployeeHistory.create({
          employee: targetUser._id,
          employeeName: empName,
          employeeId: empId,
          changeType: 'Status Change',
          action: 'Employee Terminated',
          previousDepartment: targetUser.department || targetUser.jobDetails?.department || '',
          newDepartment: targetUser.department || targetUser.jobDetails?.department || '',
          previousDesignation: targetUser.designation || targetUser.jobDetails?.designation || '',
          newDesignation: targetUser.designation || targetUser.jobDetails?.designation || '',
          previousStatus: targetUser.employmentStatus || 'Active',
          newStatus: 'Terminated',
          effectiveDate: termDate,
          reason: terminationReason.trim(),
          remarks: comments ? comments.trim() : 'Employment terminated by HR/Admin',
          performedBy: req.user.userId,
          performedByName: hrName,
        });
      }
    } catch (histErr) {
      console.error('Error logging employee history for termination:', histErr);
    }

    // Check if there is an active resignation record and update it
    const activeResignation = await Resignation.findOne({
      user: userId,
      status: { $nin: ['Rejected', 'Completed'] },
    });

    if (activeResignation) {
      activeResignation.status = 'Completed';
      activeResignation.exitCompletedAt = termDate;
      activeResignation.exitCompletedBy = req.user.userId;
      activeResignation.hrRemarks = `Employee Terminated: ${terminationReason.trim()}`;
      if (activeResignation.accessManagement) {
        activeResignation.accessManagement.crmAccess = 'Revoked';
      }
      recordAudit(
        activeResignation,
        'Employee Terminated',
        activeResignation.status,
        'Completed',
        terminationReason.trim(),
        req.user
      );
      await activeResignation.save();
    }

    // Notify employee
    await createSystemNotification(
      userId,
      'Employment Status Update',
      `Your employment has been terminated effective ${termDate.toLocaleDateString()}. Reason: ${terminationReason.trim()}`,
      'Warning'
    );

    res.json(successResponse(targetUser, 'Employee terminated successfully. Historical records preserved.'));
  }),

  // 13. Access Management (Active -> Restricted -> Revoked)
  updateAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { crmAccess, emailAccess, moduleAccess, restrictedModules, notes } = req.body;

    if (!['Active', 'Restricted', 'Revoked'].includes(crmAccess)) {
      throw createValidationError('Valid crmAccess state is required: Active, Restricted, or Revoked');
    }

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';
    const oldCrmAccess = record.accessManagement?.crmAccess || 'Active';

    record.accessManagement = {
      crmAccess,
      emailAccess: emailAccess || record.accessManagement?.emailAccess || 'Active',
      moduleAccess: moduleAccess || record.accessManagement?.moduleAccess || {},
      restrictedModules: restrictedModules || (crmAccess === 'Restricted' ? ['crm', 'projects', 'finance', 'leads', 'clients', 'reports'] : []),
      notes: notes || '',
      updatedAt: new Date(),
      updatedBy: req.user.userId,
      updatedByName: hrName,
    };

    recordAudit(
      record,
      'Access Management Changed',
      oldCrmAccess,
      crmAccess,
      notes || `Access set to ${crmAccess}`,
      req.user
    );

    await record.save();

    // Update User record in MongoDB users collection
    const userUpdate = { accessStatus: crmAccess };
    if (crmAccess === 'Revoked') {
      // Full account deactivation
      userUpdate.isActive = false;
    } else if (crmAccess === 'Restricted') {
      // Employee account remains active for self-service, but operational modules are restricted
      userUpdate.isActive = true;
      userUpdate.restrictedModules = record.accessManagement.restrictedModules;
    } else if (crmAccess === 'Active') {
      // Restored full access
      userUpdate.isActive = true;
      userUpdate.restrictedModules = [];
    }

    await User.findByIdAndUpdate(record.user, userUpdate);

    res.json(successResponse(record, `Access successfully updated to ${crmAccess}`));
  }),

  // 14. Central Offboarding Details (All 9 sections in one real-time aggregation)
  getOffboardingDetails: asyncHandler(async (req, res) => {
    const record = await Resignation.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails salaryDetails bankDetails employmentStatus accessStatus isActive createdAt')
      .populate('reviewedBy', 'firstName lastName email department')
      .populate('exitCompletedBy', 'firstName lastName email department');

    if (!record) throw createNotFoundError('Resignation record not found');

    if (!isHrOrAdmin(req.user) && String(record.user._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    const userId = record.user._id;
    const lwd = record.approvedLastWorkingDay || record.proposedLastWorkingDay || new Date();

    // Query live data from MongoDB Atlas collections in parallel
    const [documents, assets, fnfRecord] = await Promise.all([
      Document.find({ owner: userId, isArchived: { $ne: true } })
        .select('name category documentNumber issueDate expiryDate status size mimeType storedName createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Asset.find({ assignedTo: userId })
        .select('assetName assetCode category status condition purchaseCost serialNumber assignedDate')
        .lean(),
      FullAndFinalSettlement.findOne({ user: userId }).lean(),
    ]);

    // Calculate real payroll figures
    let settlementFigures = null;
    try {
      if (fnfRecord) {
        settlementFigures = {
          basicSalary: fnfRecord.earnings?.pendingSalary || record.user.salaryDetails?.basicSalary || 0,
          allowances: fnfRecord.earnings?.otherEarnings || record.user.salaryDetails?.allowances || 0,
          bonus: fnfRecord.earnings?.bonusIncentives || 0,
          leaveEncashment: fnfRecord.earnings?.leaveEncashment || 0,
          grossEarnings: fnfRecord.grossEarnings || 0,
          deductions: fnfRecord.totalDeductions || 0,
          noticeRecovery: fnfRecord.deductions?.noticePeriodRecovery || 0,
          assetRecovery: fnfRecord.deductions?.assetRecovery || 0,
          netPayable: fnfRecord.netPayable || 0,
          status: fnfRecord.status || 'Pending',
          settlementId: fnfRecord._id,
        };
      } else {
        const calc = await calculateEmployeeFigures(record.user, lwd);
        settlementFigures = {
          basicSalary: calc.monthlySalary || record.user.salaryDetails?.basicSalary || 0,
          allowances: record.user.salaryDetails?.allowances || 0,
          bonus: calc.earnings?.bonusIncentives || 0,
          leaveEncashment: calc.earnings?.leaveEncashment || 0,
          grossEarnings: calc.grossEarnings || 0,
          deductions: calc.totalDeductions || 0,
          noticeRecovery: calc.deductions?.noticePeriodRecovery || 0,
          assetRecovery: calc.deductions?.assetRecovery || 0,
          netPayable: calc.netPayable || 0,
          status: 'Pending',
          workedDays: calc.workedDays,
          approvedLeaveDays: calc.approvedLeaveDays,
        };
      }
    } catch (calcErr) {
      settlementFigures = {
        basicSalary: record.user.salaryDetails?.basicSalary || 0,
        allowances: record.user.salaryDetails?.allowances || 0,
        bonus: 0,
        leaveEncashment: 0,
        grossEarnings: (record.user.salaryDetails?.basicSalary || 0) + (record.user.salaryDetails?.allowances || 0),
        deductions: record.user.salaryDetails?.deductions || 0,
        noticeRecovery: 0,
        assetRecovery: 0,
        netPayable: Math.max(0, ((record.user.salaryDetails?.basicSalary || 0) + (record.user.salaryDetails?.allowances || 0)) - (record.user.salaryDetails?.deductions || 0)),
        status: 'Pending',
      };
    }

    res.json(
      successResponse(
        {
          resignation: record,
          documents,
          assets,
          settlement: settlementFigures,
          user: record.user,
        },
        'Offboarding details retrieved successfully'
      )
    );
  }),

  // 15. Finalize Settlement calculation and status
  finalizeSettlement: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { status = 'Completed', remarks = '', settlementAmount = 0 } = req.body;

    if (!record.clearance.finance) {
      record.clearance.finance = { status: 'Pending' };
    }

    record.clearance.finance.status = 'Completed';
    record.clearance.finance.settlementStatus = status;
    record.clearance.finance.settlementAmount = Number(settlementAmount) || 0;
    record.clearance.finance.completedBy = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Finance HR';
    record.clearance.finance.completedDate = new Date();
    record.clearance.finance.remarks = remarks || 'Final settlement approved and finalized';

    if (record.finalSettlement) {
      record.finalSettlement.status = status;
      record.finalSettlement.settledAt = new Date();
      record.finalSettlement.remarks = remarks;
      if (settlementAmount) record.finalSettlement.netPayable = Number(settlementAmount);
    }

    recordAudit(
      record,
      'Final Settlement Processed',
      'Pending',
      status,
      `Amount: ₹${Number(settlementAmount).toLocaleString('en-IN')}. ${remarks}`,
      req.user
    );

    await record.save();

    // Persist to fullandfinalsettlements collection in MongoDB Atlas (preventing duplicates)
    try {
      const netAmt = Number(settlementAmount) || 0;
      const validStatuses = ['Pending', 'In Progress', 'Clearance Pending', 'Calculation Pending', 'Approval Pending', 'Approved', 'Rejected', 'On Hold', 'Payment Processing', 'Paid', 'Completed'];
      const settlementStatus = validStatuses.includes(status) ? status : 'Completed';
      const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'Finance HR';

      let settlementDoc = await FullAndFinalSettlement.findOne({
        $or: [
          { resignation: record._id },
          { user: record.user }
        ]
      });

      const empUser = await User.findById(record.user);
      const lwd = record.approvedLastWorkingDay || record.proposedLastWorkingDay || new Date();
      const snapshot = toEmployeeSnapshot(empUser, empUser?.exitDate || lwd, lwd);

      if (settlementDoc) {
        settlementDoc.resignation = record._id;
        settlementDoc.status = settlementStatus;
        settlementDoc.netPayable = netAmt;
        settlementDoc.grossEarnings = Math.max(netAmt, settlementDoc.grossEarnings || 0);
        settlementDoc.lastWorkingDay = lwd;
        settlementDoc.settlementDate = new Date();
        settlementDoc.updatedBy = req.user.userId;
        if (!settlementDoc.employeeSnapshot?.name) {
          settlementDoc.employeeSnapshot = snapshot;
        }
        settlementDoc.history.push({
          action: 'Finalized from Resignation',
          note: remarks || 'Settlement finalized via Resignation workflow',
          performedBy: req.user.userId,
          performedByName: hrName,
          at: new Date(),
        });
        if (['Completed', 'Approved', 'Paid'].includes(settlementStatus)) {
          settlementDoc.approval = settlementDoc.approval || {};
          settlementDoc.approval.approvedBy = req.user.userId;
          settlementDoc.approval.approvedAt = new Date();
        }
        await settlementDoc.save();
      } else {
        settlementDoc = await FullAndFinalSettlement.create({
          user: record.user,
          resignation: record._id,
          employeeSnapshot: snapshot,
          lastWorkingDay: lwd,
          exitDate: empUser?.exitDate || lwd,
          settlementDate: new Date(),
          status: settlementStatus,
          earnings: { pendingSalary: netAmt },
          deductions: {},
          grossEarnings: netAmt,
          totalDeductions: 0,
          netPayable: netAmt,
          approval: {
            approvedBy: req.user.userId,
            approvedAt: new Date(),
          },
          createdBy: req.user.userId,
          updatedBy: req.user.userId,
          history: [{
            action: 'Created & Finalized',
            note: remarks || 'Created and finalized via Resignation workflow',
            performedBy: req.user.userId,
            performedByName: hrName,
            at: new Date(),
          }],
        });
      }
    } catch (settleErr) {
      console.error('Error synchronizing fullandfinalsettlements document:', settleErr);
    }

    res.json(successResponse(record, 'Final settlement marked as processed'));
  }),
};
