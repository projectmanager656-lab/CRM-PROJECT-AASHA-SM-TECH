import mongoose from 'mongoose';
import Onboarding, { getDefaultChecklist } from '../models/Onboarding.js';
import User from '../models/User.js';
import Candidate from '../models/Candidate.js';
import Document from '../models/Document.js';
import Asset from '../models/Asset.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const actorName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'HR Manager';

export const OnboardingController = {
  // 1. Dynamic Onboarding Summary KPIs
  summary: asyncHandler(async (_req, res) => {
    const all = await Onboarding.find().lean();

    const pendingOnboarding = all.filter((o) => o.status === 'Pending').length;
    const inProgress = all.filter((o) => o.status === 'In Progress').length;
    const completed = all.filter((o) => o.status === 'Completed').length;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const joiningThisWeek = all.filter((o) => {
      if (!o.joiningDate) return false;
      const jd = new Date(o.joiningDate);
      return jd >= startOfWeek && jd <= endOfWeek;
    }).length;

    const documentsPending = all.filter((o) =>
      o.status !== 'Completed' &&
      (o.checklist || []).some((item) => item.category === 'Documentation' && item.status === 'Pending')
    ).length;

    const assetsPending = all.filter((o) =>
      o.status !== 'Completed' &&
      (o.checklist || []).some((item) => item.task.includes('Asset') || item.task.includes('Laptop') && item.status === 'Pending')
    ).length;

    const accessPending = all.filter((o) =>
      o.status !== 'Completed' &&
      (o.checklist || []).some((item) => item.task.includes('Access') || item.task.includes('Email') && item.status === 'Pending')
    ).length;

    res.json(
      successResponse(
        {
          pendingOnboarding,
          inProgress,
          joiningThisWeek,
          documentsPending,
          assetsPending,
          accessPending,
          completed,
          total: all.length,
        },
        'Onboarding summary computed successfully'
      )
    );
  }),

  // 2. List Onboarding Records
  list: asyncHandler(async (req, res) => {
    const filter = {};

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    if (req.query.department && req.query.department !== 'All') {
      filter.department = req.query.department;
    }

    let records = await Onboarding.find(filter)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails employmentStatus accessStatus isActive createdAt')
      .populate('candidate', 'candidateId name email phone appliedPosition department status stage')
      .populate('assignedHr', 'firstName lastName email department')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.search) {
      const q = req.query.search.toLowerCase().trim();
      records = records.filter((r) => {
        const name = (r.employee?.personalInfo?.fullName || `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`).toLowerCase();
        const email = (r.employee?.email || '').toLowerCase();
        const empId = (r.employeeId || r.employee?.jobDetails?.employeeId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || empId.includes(q);
      });
    }

    res.json(successResponse(records, 'Onboarding records retrieved successfully'));
  }),

  // 3. Eligible Employees for Starting Onboarding
  eligibleEmployees: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    // Find employees who do not have an active or completed onboarding
    const existingOnboardings = await Onboarding.find().select('employee candidate').lean();
    const existingEmpIds = new Set(existingOnboardings.map((o) => String(o.employee)));
    const existingCandidateIds = new Set(existingOnboardings.map((o) => o.candidate ? String(o.candidate) : null).filter(Boolean));

    const eligibleUsers = await User.find({
      _id: { $nin: Array.from(existingEmpIds) },
      isActive: true,
      employmentStatus: { $ne: 'Exited' },
    })
      .select('firstName lastName email department designation personalInfo jobDetails')
      .sort({ createdAt: -1 })
      .lean();

    const hiredCandidates = await Candidate.find({
      _id: { $nin: Array.from(existingCandidateIds) },
      stage: { $in: ['Selected', 'Offer', 'Hired'] },
    })
      .select('candidateId name email phone appliedPosition department status stage convertedEmployeeId')
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      successResponse(
        { employees: eligibleUsers, candidates: hiredCandidates },
        'Eligible candidates & employees for onboarding'
      )
    );
  }),

  // 4. Get Single Onboarding Details (Aggregating real Documents, Assets, Access)
  get: asyncHandler(async (req, res) => {
    const onboarding = await Onboarding.findById(req.params.id)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails bankDetails salaryDetails employmentStatus accessStatus restrictedModules isActive createdAt')
      .populate('candidate', 'candidateId name email phone appliedPosition department status stage')
      .populate('assignedHr', 'firstName lastName email department designation');

    if (!onboarding) throw createNotFoundError('Onboarding record not found');

    const empId = onboarding.employee?._id;

    // Concurrently fetch real Documents, real Assets, and Access details
    const [documents, assets] = await Promise.all([
      empId ? Document.find({ owner: empId, isArchived: { $ne: true } }).lean() : [],
      empId ? Asset.find({ assignedTo: empId }).lean() : [],
    ]);

    const userAccess = {
      accessStatus: onboarding.employee?.accessStatus || 'Active',
      isActive: onboarding.employee?.isActive !== false,
      restrictedModules: onboarding.employee?.restrictedModules || [],
    };

    res.json(
      successResponse(
        {
          onboarding,
          documents,
          assets,
          userAccess,
        },
        'Onboarding details retrieved'
      )
    );
  }),

  // 5. Start Onboarding
  create: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      employeeId: inputEmpId,
      userId,
      candidateId,
      joiningDate,
      department,
      designation,
      employmentType,
      reportingManager,
      workLocation,
      contactInformation,
      emergencyContact,
      assignedHr,
      remarks,
    } = req.body;

    let targetUser = null;

    if (userId) {
      targetUser = await User.findById(userId);
    } else if (candidateId) {
      const candidate = await Candidate.findById(candidateId);
      if (!candidate) throw createNotFoundError('Candidate not found');

      if (candidate.convertedEmployeeId) {
        targetUser = await User.findById(candidate.convertedEmployeeId);
      } else {
        // Auto convert candidate to employee if not yet converted
        let existingUser = await User.findOne({ email: candidate.email });
        if (!existingUser) {
          const parts = candidate.name.split(' ');
          const firstName = parts[0] || 'Employee';
          const lastName = parts.slice(1).join(' ') || 'Staff';
          const generatedEmpId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;

          existingUser = await User.create({
            firstName,
            lastName,
            email: candidate.email,
            password: `Pass@${Math.floor(1000 + Math.random() * 9000)}`,
            phone: candidate.phone,
            department: department || candidate.department || 'Tech',
            designation: designation || candidate.appliedPosition || 'Associate',
            location: workLocation || candidate.location || 'Headquarters / Main Office',
            role: 'employee',
            isActive: true,
            employmentStatus: 'Probation',
            personalInfo: {
              fullName: candidate.name,
              email: candidate.email,
              phoneNumber: candidate.phone,
              address: candidate.location || '',
            },
            jobDetails: {
              employeeId: generatedEmpId,
              department: department || candidate.department || 'Tech',
              designation: designation || candidate.appliedPosition || 'Associate',
              joiningDate: joiningDate || new Date().toISOString().slice(0, 10),
              employmentType: employmentType || 'Full Time',
            },
          });
        }
        candidate.convertedEmployeeId = existingUser._id;
        candidate.stage = 'Hired';
        candidate.status = 'Hired';
        await candidate.save();
        targetUser = existingUser;
      }
    }

    if (!targetUser) throw createValidationError('Valid employee selection or candidate is required');

    // Check for existing active onboarding
    const existingActive = await Onboarding.findOne({
      employee: targetUser._id,
      status: { $ne: 'Completed' },
    });

    if (existingActive) {
      throw createValidationError('An active onboarding process is already in progress for this employee');
    }

    const empCode = inputEmpId || targetUser.jobDetails?.employeeId || `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
    const jDate = joiningDate ? new Date(joiningDate) : new Date();

    const onboarding = new Onboarding({
      employee: targetUser._id,
      candidate: candidateId || null,
      employeeId: empCode,
      department: department || targetUser.department || targetUser.jobDetails?.department || 'Tech',
      designation: designation || targetUser.designation || targetUser.jobDetails?.designation || 'Associate',
      joiningDate: jDate,
      employmentType: employmentType || targetUser.jobDetails?.employmentType || 'Full Time',
      reportingManager: reportingManager || targetUser.jobDetails?.reportingManager || '',
      workLocation: workLocation || targetUser.location || 'Headquarters / Main Office',
      contactInformation: {
        phone: contactInformation?.phone || targetUser.phone || '',
        email: contactInformation?.email || targetUser.email || '',
        address: contactInformation?.address || targetUser.personalInfo?.address || '',
      },
      emergencyContact: {
        name: emergencyContact?.name || '',
        relationship: emergencyContact?.relationship || '',
        phone: emergencyContact?.phone || '',
      },
      assignedHr: assignedHr || req.user.userId,
      status: 'Pending',
      remarks: remarks || 'Onboarding process initiated',
      checklist: getDefaultChecklist(jDate),
      auditTrail: [
        {
          action: 'Onboarding Initiated',
          previousStatus: '',
          newStatus: 'Pending',
          performedBy: req.user.userId,
          performedByName: actorName(req.user),
          remarks: 'Onboarding record created with standard 17-item checklist',
          date: new Date(),
        },
      ],
    });

    await onboarding.save();

    const populated = await Onboarding.findById(onboarding._id)
      .populate('employee', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('assignedHr', 'firstName lastName email');

    res.status(201).json(createdResponse(populated, 'Onboarding process initiated successfully'));
  }),

  // 6. Update Onboarding Details
  update: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) throw createNotFoundError('Onboarding record not found');

    const {
      reportingManager,
      workLocation,
      contactInformation,
      emergencyContact,
      assignedHr,
      remarks,
      joiningDate,
      department,
      designation,
      employmentType,
    } = req.body;

    if (reportingManager !== undefined) onboarding.reportingManager = reportingManager.trim();
    if (workLocation !== undefined) onboarding.workLocation = workLocation.trim();
    if (contactInformation) onboarding.contactInformation = { ...onboarding.contactInformation, ...contactInformation };
    if (emergencyContact) onboarding.emergencyContact = { ...onboarding.emergencyContact, ...emergencyContact };
    if (assignedHr !== undefined) onboarding.assignedHr = assignedHr;
    if (remarks !== undefined) onboarding.remarks = remarks.trim();
    if (joiningDate) onboarding.joiningDate = new Date(joiningDate);
    if (department) onboarding.department = department.trim();
    if (designation) onboarding.designation = designation.trim();
    if (employmentType) onboarding.employmentType = employmentType;

    await onboarding.save();
    res.json(successResponse(onboarding, 'Onboarding details updated successfully'));
  }),

  // 7. Update Checklist Item Status
  updateChecklist: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) throw createNotFoundError('Onboarding record not found');

    const { itemId, status, owner, dueDate, remarks } = req.body;
    if (!itemId) throw createValidationError('Checklist item ID is required');

    const item = onboarding.checklist.id(itemId);
    if (!item) throw createNotFoundError('Checklist item not found');

    const oldStatus = item.status;
    if (status !== undefined) {
      item.status = status;
      if (status === 'Completed') {
        item.completionDate = new Date();
      } else {
        item.completionDate = null;
      }
    }

    if (owner !== undefined) item.owner = owner;
    if (dueDate !== undefined) item.dueDate = dueDate ? new Date(dueDate) : null;
    if (remarks !== undefined) item.remarks = remarks;

    // If item was updated and overall status is Pending, transition to In Progress
    if (onboarding.status === 'Pending' && status === 'In Progress' || status === 'Completed') {
      onboarding.status = 'In Progress';
      onboarding.auditTrail.unshift({
        action: 'Status Transition',
        previousStatus: 'Pending',
        newStatus: 'In Progress',
        performedBy: req.user.userId,
        performedByName: actorName(req.user),
        remarks: `Checklist item "${item.task}" updated to ${status}`,
        date: new Date(),
      });
    }

    onboarding.auditTrail.unshift({
      action: `Checklist: ${item.task}`,
      previousStatus: oldStatus,
      newStatus: status || oldStatus,
      performedBy: req.user.userId,
      performedByName: actorName(req.user),
      remarks: remarks || `Checklist item updated to ${status}`,
      date: new Date(),
    });

    await onboarding.save();
    res.json(successResponse(onboarding, 'Checklist item updated successfully'));
  }),

  // 8. Complete Onboarding -> Transition to Active Employee
  complete: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) throw createNotFoundError('Onboarding record not found');

    if (onboarding.status === 'Completed') {
      throw createValidationError('Onboarding has already been marked as Completed');
    }

    onboarding.status = 'Completed';
    onboarding.completionDate = new Date();
    onboarding.remarks = req.body.remarks || onboarding.remarks || 'Onboarding successfully completed';

    onboarding.auditTrail.unshift({
      action: 'Onboarding Completed',
      previousStatus: 'In Progress',
      newStatus: 'Completed',
      performedBy: req.user.userId,
      performedByName: actorName(req.user),
      remarks: onboarding.remarks,
      date: new Date(),
    });

    await onboarding.save();

    // Transition employee lifecycle status in MongoDB User model to 'Active'
    const updatedUser = await User.findByIdAndUpdate(
      onboarding.employee,
      {
        employmentStatus: 'Active',
        isActive: true,
        $push: {
          lifecycleHistory: {
            changeType: 'Status Change',
            action: 'Onboarding Completed',
            previousStatus: 'Probation',
            newStatus: 'Active',
            effectiveDate: new Date(),
            reason: 'Formal employee onboarding successfully completed',
            remarks: onboarding.remarks,
            performedBy: req.user.userId,
            performedByName: actorName(req.user),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    res.json(
      successResponse(
        { onboarding, employee: updatedUser },
        'Employee onboarding completed and active lifecycle status confirmed'
      )
    );
  }),
};
