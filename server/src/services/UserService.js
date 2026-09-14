import User from '../models/User.js';
import Department from '../models/Department.js';
import EmployeeHistory from '../models/EmployeeHistory.js';
import {
  createForbiddenError,
  createNotFoundError,
  createValidationError,
} from '../utils/apiError.js';

const allowedRoles = ['employee'];
const OFFICIAL_DEPARTMENTS = [
  'HR',
  'Finance',
  'Business Development',
  'Digital Marketing',
  'Video Editor',
  'Tech',
];

/**
 * Validates department dynamically against official list AND active Department Master records.
 */
const isValidDepartment = async (dept) => {
  const trimmed = String(dept || '').trim();
  if (!trimmed) return true;
  if (OFFICIAL_DEPARTMENTS.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return true;
  try {
    const exists = await Department.findOne({
      name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      status: 'Active',
    });
    return !!exists;
  } catch (err) {
    return true;
  }
};

/**
 * Returns performer display name from User collection.
 */
const getPerformerName = async (userId) => {
  if (!userId) return 'HR Administrator';
  try {
    const user = await User.findById(userId).select('firstName lastName email personalInfo');
    if (!user) return 'HR Administrator';
    return (
      user.personalInfo?.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email ||
      'HR Administrator'
    );
  } catch (err) {
    return 'HR Administrator';
  }
};

export class UserService {
  static async getAllUsers(filters = {}) {
    const query = {};
    if (filters.department) query.department = String(filters.department).trim();
    const users = await User.find(query).sort({ createdAt: -1 });
    return users.map((user) => user.toJSON());
  }

  static async getUserById(id) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    return user.toJSON();
  }

  static async createUser(userData, currentUserId = null) {
    const personalInfo = userData.personalInfo || {};
    const jobDetails = userData.jobDetails || {};
    const bankDetails = userData.bankDetails || {};

    let fullName = (personalInfo.fullName || userData.fullName || '').trim();
    let firstName = userData.firstName?.trim() || '';
    let lastName = userData.lastName?.trim() || '';

    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || 'Employee';
      lastName = parts.slice(1).join(' ') || ' ';
    } else if (firstName && !fullName) {
      fullName = [firstName, lastName].filter(Boolean).join(' ');
    }

    const email = (personalInfo.email || userData.email || '').trim().toLowerCase();
    const phone = (personalInfo.phoneNumber || userData.phone || '').trim();
    const department = (jobDetails.department || userData.department || '').trim();
    const designation = (jobDetails.designation || userData.designation || '').trim();
    const role = userData.role || 'employee';
    const isActive = userData.isActive !== undefined ? userData.isActive : true;
    const employmentStatus = userData.employmentStatus || 'Active';

    // Auto-generate password if not provided in form
    const password = userData.password || `Pass@${Math.floor(1000 + Math.random() * 9000)}`;

    if (!firstName || !email) {
      throw createValidationError('Full name and email address are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createValidationError('User with this email already exists');
    }

    const selectedRole = allowedRoles.includes(role) ? role : 'employee';
    const selectedDepartment = String(department || '').trim();
    if (selectedDepartment) {
      const valid = await isValidDepartment(selectedDepartment);
      if (!valid) {
        throw createValidationError('Please select a valid official or active department');
      }
    }

    const performerName = await getPerformerName(currentUserId);
    const joiningDate = jobDetails.joiningDate || new Date().toISOString().slice(0, 10);
    const workLocation = jobDetails.workLocation || personalInfo.address || userData.location || '';

    const joiningHistory = {
      changeType: 'Joining',
      action: 'Employee Onboarded',
      previousDepartment: '',
      newDepartment: selectedDepartment,
      previousDesignation: '',
      newDesignation: designation,
      previousManager: '',
      newManager: jobDetails.reportingManager || '',
      previousStatus: '',
      newStatus: employmentStatus,
      previousLocation: '',
      newLocation: workLocation,
      effectiveDate: new Date(joiningDate),
      reason: 'Initial Onboarding',
      remarks: 'Employee account created in system',
      performedBy: currentUserId || null,
      performedByName: performerName,
      createdAt: new Date(),
    };

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      department: selectedDepartment,
      designation,
      location: workLocation,
      role: selectedRole,
      isActive,
      employmentStatus,
      personalInfo: {
        profilePhoto: personalInfo.profilePhoto || '',
        fullName: fullName || `${firstName} ${lastName}`.trim(),
        email,
        phoneNumber: phone,
        dateOfBirth: personalInfo.dateOfBirth || '',
        gender: personalInfo.gender || '',
        address: personalInfo.address || '',
      },
      jobDetails: {
        employeeId: jobDetails.employeeId || `EMP-${Date.now().toString().slice(-5)}`,
        department: selectedDepartment,
        designation,
        joiningDate,
        employmentType: jobDetails.employmentType || 'Full Time',
        reportingManager: jobDetails.reportingManager || '',
        workLocation,
        probationEndDate: jobDetails.probationEndDate || '',
        confirmationDate: jobDetails.confirmationDate || '',
        noticePeriodDays: jobDetails.noticePeriodDays || 30,
      },
      bankDetails: {
        accountHolderName: bankDetails.accountHolderName || '',
        bankName: bankDetails.bankName || '',
        accountNumber: bankDetails.accountNumber || '',
        ifscCode: bankDetails.ifscCode ? bankDetails.ifscCode.toUpperCase() : '',
        branchName: bankDetails.branchName || '',
      },
      lifecycleHistory: [joiningHistory],
    });

    // Also persist in EmployeeHistory collection
    try {
      await EmployeeHistory.create({
        employee: user._id,
        employeeName: fullName || `${firstName} ${lastName}`.trim(),
        employeeId: user.jobDetails?.employeeId || '',
        ...joiningHistory,
      });
    } catch (err) {
      console.error('Failed to log EmployeeHistory collection entry on user create:', err);
    }

    return user.toJSON();
  }

  static async updateUser(id, updateData, currentUserId = null) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    const personalInfo = updateData.personalInfo;
    const jobDetails = updateData.jobDetails;
    const bankDetails = updateData.bankDetails;

    if (personalInfo) {
      if (personalInfo.fullName) {
        const parts = personalInfo.fullName.trim().split(/\s+/);
        user.firstName = parts[0] || user.firstName;
        user.lastName = parts.slice(1).join(' ') || user.lastName;
      }
      if (personalInfo.phoneNumber !== undefined) user.phone = personalInfo.phoneNumber.trim();
      if (personalInfo.address !== undefined) user.location = personalInfo.address.trim();
      user.personalInfo = { ...(user.personalInfo?.toObject ? user.personalInfo.toObject() : user.personalInfo || {}), ...personalInfo };
    }

    if (jobDetails) {
      if (jobDetails.department !== undefined) {
        const valid = await isValidDepartment(jobDetails.department);
        if (!valid) throw createValidationError('Please select a valid official or active department');
        user.department = jobDetails.department.trim();
      }
      if (jobDetails.designation !== undefined) user.designation = jobDetails.designation.trim();
      if (jobDetails.workLocation !== undefined) user.location = jobDetails.workLocation.trim();
      user.jobDetails = { ...(user.jobDetails?.toObject ? user.jobDetails.toObject() : user.jobDetails || {}), ...jobDetails };
    }

    if (bankDetails) {
      if (bankDetails.ifscCode) bankDetails.ifscCode = bankDetails.ifscCode.toUpperCase();
      user.bankDetails = { ...(user.bankDetails?.toObject ? user.bankDetails.toObject() : user.bankDetails || {}), ...bankDetails };
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      designation,
      role,
      isActive,
      employmentStatus,
      workLocation,
    } = updateData;

    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (workLocation !== undefined) {
      user.location = workLocation.trim();
      if (!user.jobDetails) user.jobDetails = {};
      user.jobDetails.workLocation = workLocation.trim();
    }

    if (department !== undefined) {
      const selectedDepartment = department.trim();
      if (selectedDepartment) {
        const valid = await isValidDepartment(selectedDepartment);
        if (!valid) throw createValidationError('Please select a valid official or active department');
      }
      user.department = selectedDepartment;
      if (!user.jobDetails) user.jobDetails = {};
      user.jobDetails.department = selectedDepartment;
    }
    if (designation !== undefined) {
      user.designation = designation.trim();
      if (!user.jobDetails) user.jobDetails = {};
      user.jobDetails.designation = designation.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          throw createValidationError('User with this email already exists');
        }
      }
      user.email = normalizedEmail;
    }

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        throw createValidationError('Invalid role selected');
      }
      user.role = role;
    }

    // Handle employmentStatus update if explicitly passed
    if (employmentStatus !== undefined) {
      const allowedStatuses = ['Active', 'Probation', 'On Leave', 'Notice Period', 'Inactive', 'Exited', 'Terminated'];
      if (!allowedStatuses.includes(employmentStatus)) {
        throw createValidationError(`Invalid employment status. Allowed: ${allowedStatuses.join(', ')}`);
      }
      user.employmentStatus = employmentStatus;
      // Only set isActive false if fully deactivating
      if (['Inactive', 'Exited', 'Terminated'].includes(employmentStatus)) {
        user.isActive = false;
      } else {
        user.isActive = true;
      }
    }

    if (typeof isActive === 'boolean') {
      if (currentUserId && currentUserId === id && isActive === false) {
        throw createForbiddenError('You cannot deactivate your own account');
      }
      user.isActive = isActive;
    }

    if (password) {
      if (password.length < 6) {
        throw createValidationError('Password must be at least 6 characters');
      }
      user.password = password;
    }

    await user.save();
    return user.toJSON();
  }

  static async transferEmployee(id, transferData, currentUserId = null) {
    const user = await User.findById(id);
    if (!user) {
      throw createNotFoundError('Employee not found');
    }

    const {
      department,
      designation,
      reportingManager,
      workLocation,
      changeType = 'Transfer',
      effectiveDate,
      reason,
      remarks,
    } = transferData;

    if (department) {
      const valid = await isValidDepartment(department);
      if (!valid) {
        throw createValidationError('Please select a valid official or active department');
      }
    }

    const previousDepartment = user.jobDetails?.department || user.department || '';
    const previousDesignation = user.jobDetails?.designation || user.designation || '';
    const previousManager = user.jobDetails?.reportingManager || '';
    const previousLocation = user.jobDetails?.workLocation || user.location || '';

    const newDept = department !== undefined ? department.trim() : previousDepartment;
    const newDesig = designation !== undefined ? designation.trim() : previousDesignation;
    const newMgr = reportingManager !== undefined ? reportingManager.trim() : previousManager;
    const newLoc = workLocation !== undefined ? workLocation.trim() : previousLocation;

    const performerName = await getPerformerName(currentUserId);
    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    // Update User model
    user.department = newDept;
    user.designation = newDesig;
    if (newLoc) user.location = newLoc;

    if (!user.jobDetails) user.jobDetails = {};
    user.jobDetails.department = newDept;
    user.jobDetails.designation = newDesig;
    user.jobDetails.reportingManager = newMgr;
    user.jobDetails.workLocation = newLoc;

    const actionText =
      changeType === 'Promotion'
        ? `Promoted to ${newDesig} (${newDept})`
        : changeType === 'Transfer'
        ? `Transferred from ${previousDepartment || 'General'} to ${newDept}`
        : changeType === 'Designation Change'
        ? `Designation updated from ${previousDesignation || '—'} to ${newDesig}`
        : `Role/Assignment updated to ${newDept} - ${newDesig}`;

    const historyEvent = {
      changeType: changeType || 'Transfer',
      action: actionText,
      previousDepartment,
      newDepartment: newDept,
      previousDesignation,
      newDesignation: newDesig,
      previousManager,
      newManager: newMgr,
      previousLocation,
      newLocation: newLoc,
      effectiveDate: effDate,
      reason: String(reason || '').trim(),
      remarks: String(remarks || '').trim(),
      performedBy: currentUserId || null,
      performedByName: performerName,
      createdAt: new Date(),
    };

    if (!Array.isArray(user.lifecycleHistory)) {
      user.lifecycleHistory = [];
    }
    user.lifecycleHistory.unshift(historyEvent);

    await user.save();

    // Also record in EmployeeHistory collection
    try {
      await EmployeeHistory.create({
        employee: user._id,
        employeeName:
          user.personalInfo?.fullName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.email,
        employeeId: user.jobDetails?.employeeId || '',
        ...historyEvent,
      });
    } catch (err) {
      console.error('Failed to log EmployeeHistory collection entry on transfer:', err);
    }

    return user.toJSON();
  }

  static async updateEmployeeStatus(id, statusData, currentUserId = null) {
    const user = await User.findById(id);
    if (!user) {
      throw createNotFoundError('Employee not found');
    }

    const { status, reason, remarks, effectiveDate } = statusData;
    const allowedStatuses = ['Active', 'Probation', 'On Leave', 'Notice Period', 'Inactive', 'Exited', 'Terminated'];
    if (!status || !allowedStatuses.includes(status)) {
      throw createValidationError(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
    }

    const previousStatus = user.employmentStatus || (user.isActive ? 'Active' : 'Inactive');
    const performerName = await getPerformerName(currentUserId);
    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    user.employmentStatus = status;

    // SAFETY RULE 2:
    // Only set isActive=false for full account deactivations (Inactive, Exited, Terminated).
    // Routine module status changes (Probation, On Leave, Notice Period, Active) keep isActive=true!
    if (['Inactive', 'Exited', 'Terminated'].includes(status)) {
      if (currentUserId && currentUserId === id) {
        throw createForbiddenError('You cannot deactivate your own account');
      }
      user.isActive = false;
      if (status === 'Exited' && !user.exitDate) {
        user.exitDate = effDate;
      }
    } else {
      user.isActive = true;
    }

    const historyEvent = {
      changeType: 'Status Change',
      action: `Status changed from ${previousStatus} to ${status}`,
      previousStatus,
      newStatus: status,
      effectiveDate: effDate,
      reason: String(reason || '').trim(),
      remarks: String(remarks || '').trim(),
      performedBy: currentUserId || null,
      performedByName: performerName,
      createdAt: new Date(),
    };

    if (!Array.isArray(user.lifecycleHistory)) {
      user.lifecycleHistory = [];
    }
    user.lifecycleHistory.unshift(historyEvent);

    await user.save();

    // Also record in EmployeeHistory collection
    try {
      await EmployeeHistory.create({
        employee: user._id,
        employeeName:
          user.personalInfo?.fullName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.email,
        employeeId: user.jobDetails?.employeeId || '',
        ...historyEvent,
      });
    } catch (err) {
      console.error('Failed to log EmployeeHistory collection entry on status update:', err);
    }

    return user.toJSON();
  }

  static async getEmployeeHistory(id) {
    const user = await User.findById(id).select('lifecycleHistory personalInfo firstName lastName email jobDetails');
    if (!user) {
      throw createNotFoundError('Employee not found');
    }

    const collectionHistory = await EmployeeHistory.find({ employee: id })
      .sort({ effectiveDate: -1, createdAt: -1 })
      .lean();

    if (collectionHistory && collectionHistory.length > 0) {
      return collectionHistory;
    }

    return (user.lifecycleHistory || []).sort(
      (a, b) => new Date(b.effectiveDate || b.createdAt) - new Date(a.effectiveDate || a.createdAt)
    );
  }

  static async deactivateUser(id, currentUserId) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    if (currentUserId && currentUserId === id) {
      throw createForbiddenError('You cannot deactivate your own account');
    }

    user.isActive = false;
    user.employmentStatus = 'Inactive';
    await user.save();

    return user.toJSON();
  }
}

export default UserService;
