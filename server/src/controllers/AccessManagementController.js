import User from '../models/User.js';
import Module from '../models/Module.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';
import AccessAudit from '../models/AccessAudit.js';
import Department from '../models/Department.js';
import { RBAC_MODULES, buildActionState } from '../config/rbacCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/apiError.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

export const AccessManagementController = {
  // 0. Dynamic System Metadata (Departments, Designations, Roles, Modules)
  getMetadata: asyncHandler(async (_req, res) => {
    const [deptRecords, userDepts, userDesigs, roles, modules] = await Promise.all([
      Department.find({ status: 'Active' }).select('name').lean().catch(() => []),
      User.distinct('department'),
      User.distinct('designation'),
      Role.find({ status: 'Active' }).select('key name').sort({ sortOrder: 1 }).lean().catch(() => []),
      Module.find({ status: 'Active' }).select('key name category description resources').sort({ displayOrder: 1, name: 1 }).lean().catch(() => []),
    ]);

    const deptSet = new Set([
      ...deptRecords.map((d) => d.name),
      ...userDepts.filter(Boolean),
    ]);
    const departments = Array.from(deptSet).filter(Boolean).sort();

    const desigSet = new Set(userDesigs.filter(Boolean));
    const designations = Array.from(desigSet).filter(Boolean).sort();

    const activeModules = modules && modules.length > 0 ? modules : RBAC_MODULES;

    res.json(
      successResponse(
        {
          departments,
          designations,
          roles: roles && roles.length > 0 ? roles : [
            { key: 'employee', name: 'Employee' },
            { key: 'admin', name: 'Admin' },
            { key: 'super_admin', name: 'Super Admin' },
          ],
          modules: activeModules.map((m) => ({
            key: m.key,
            name: m.name,
            category: m.category || 'core',
            description: m.description || '',
            resources: m.resources || [],
          })),
        },
        'System metadata retrieved'
      )
    );
  }),

  // 1. Dynamic Summary Metrics
  getSummary: asyncHandler(async (_req, res) => {
    const [totalEmployees, activeAccess, restrictedAccess, revokedAccess, totalAudits] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ accessStatus: 'Active' }),
      User.countDocuments({ accessStatus: 'Restricted' }),
      User.countDocuments({ accessStatus: 'Revoked' }),
      AccessAudit.countDocuments(),
    ]);

    res.json(
      successResponse(
        {
          totalEmployees,
          activeAccess,
          restrictedAccess,
          revokedAccess,
          pendingAccessChanges: restrictedAccess,
          totalAudits,
        },
        'Access Management summary retrieved'
      )
    );
  }),

  // 2. List All Real Employees from MongoDB Atlas
  listEmployees: asyncHandler(async (req, res) => {
    const { search, department, designation, role, accessStatus, employmentStatus } = req.query;
    const filter = {};

    if (department && department !== 'All') filter.department = department;
    if (designation && designation !== 'All') filter.designation = designation;
    if (role && role !== 'All') filter.role = role;
    if (accessStatus && accessStatus !== 'All') filter.accessStatus = accessStatus;
    if (employmentStatus && employmentStatus !== 'All') filter.employmentStatus = employmentStatus;

    let users = await User.find(filter)
      .select('firstName lastName email phone department designation role employmentStatus accessStatus restrictedModules rbacRoleId rbacRoleKey lastAccessChange createdAt jobDetails personalInfo')
      .sort({ createdAt: -1 })
      .lean();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter((u) => {
        const name = (u.personalInfo?.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
        const email = (u.email || '').toLowerCase();
        const empId = (u.jobDetails?.employeeId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || empId.includes(q);
      });
    }

    // Dynamic catalog count
    const activeModules = await Module.find({ status: 'Active' }).select('key').lean();
    const totalModuleKeys = activeModules.map((m) => m.key.toLowerCase());
    const defaultModuleCount = totalModuleKeys.length || RBAC_MODULES.length;

    const mapped = users.map((u) => {
      const restrictedSet = new Set((u.restrictedModules || []).map((m) => String(m).toLowerCase()));
      let assignedCount = 0;

      if (u.accessStatus === 'Revoked') {
        assignedCount = 0;
      } else if (u.accessStatus === 'Restricted') {
        assignedCount = Math.max(0, defaultModuleCount - restrictedSet.size);
      } else {
        assignedCount = defaultModuleCount;
      }

      const fullName = u.personalInfo?.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
      const employeeId = u.jobDetails?.employeeId || '';
      const department = u.department || u.jobDetails?.department || 'General';
      const designation = u.designation || u.jobDetails?.designation || 'Staff';

      return {
        ...u,
        fullName,
        employeeId,
        department,
        designation,
        assignedModulesCount: assignedCount,
        totalModulesCount: defaultModuleCount,
      };
    });

    res.json(successResponse(mapped, 'Employees access list retrieved'));
  }),

  // 3. Complete Real System Access Details for Single Employee
  getEmployeeAccess: asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select('firstName lastName email department designation role employmentStatus accessStatus restrictedModules customPermissions rbacRoleId rbacRoleKey lastAccessChange createdAt jobDetails personalInfo')
      .lean();

    if (!user) throw createNotFoundError('Employee record not found in database');

    // Retrieve active module catalog
    let modules = await Module.find({ status: 'Active' }).sort({ displayOrder: 1, name: 1 }).lean();
    if (!modules || modules.length === 0) {
      modules = RBAC_MODULES;
    }

    // Retrieve role policy
    const roleKey = user.rbacRoleKey || user.role || 'employee';
    const role = user.rbacRoleId
      ? await Role.findById(user.rbacRoleId).lean()
      : await Role.findOne({ key: roleKey }).lean();

    let policies = [];
    if (role?._id) {
      policies = await RolePermission.find({ roleId: role._id }).lean();
    }

    const policyMap = new Map();
    for (const p of policies) {
      policyMap.set(p.moduleKey.toLowerCase(), p);
    }

    const restrictedSet = new Set((user.restrictedModules || []).map((m) => String(m).toLowerCase()));
    const customPerms = user.customPermissions || {};

    const modulesBreakdown = modules.map((mod) => {
      const modKey = mod.key.toLowerCase();
      const policy = policyMap.get(modKey);
      const isRestricted = restrictedSet.has(modKey);

      let status = 'Active';
      if (user.accessStatus === 'Revoked') {
        status = 'Revoked';
      } else if (isRestricted) {
        status = 'Restricted';
      }

      // Aggregate permitted actions
      const actionsObj = {};
      const actionLabels = [];

      if (policy && policy.resourcePermissions) {
        for (const res of policy.resourcePermissions) {
          if (res.actions) {
            for (const [actionKey, enabled] of Object.entries(res.actions)) {
              if (enabled) {
                actionsObj[actionKey] = true;
                if (!actionLabels.includes(actionKey)) actionLabels.push(actionKey);
              }
            }
          }
        }
      }

      // Check user-level custom overrides
      if (customPerms[mod.key] || customPerms[modKey]) {
        const custom = customPerms[mod.key] || customPerms[modKey];
        for (const [actionKey, enabled] of Object.entries(custom)) {
          if (enabled) {
            actionsObj[actionKey] = true;
            if (!actionLabels.includes(actionKey)) actionLabels.push(actionKey);
          }
        }
      }

      // If no explicit actions found from policy, fallback to standard role actions
      if (actionLabels.length === 0) {
        actionLabels.push('view', 'read');
        actionsObj['view'] = true;
        actionsObj['read'] = true;
      }

      return {
        key: mod.key,
        name: mod.name,
        description: mod.description,
        icon: mod.icon || 'shield',
        category: mod.category || 'business',
        status,
        permissionLevels: actionLabels,
        actions: actionsObj,
        source: customPerms[mod.key] ? 'Custom Grant' : 'Role Default',
      };
    });

    // Recent Audit Trail for this Employee
    const auditTrail = await AccessAudit.find({ employee: user._id })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    const enrichedEmployee = {
      ...user,
      fullName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      employeeId: user.jobDetails?.employeeId || '',
      department: user.department || user.jobDetails?.department || 'General',
      designation: user.designation || user.jobDetails?.designation || 'Staff',
    };

    res.json(
      successResponse(
        {
          employee: enrichedEmployee,
          role: role ? { key: role.key, name: role.name } : { key: user.role, name: 'Employee' },
          modules: modulesBreakdown,
          auditTrail,
        },
        'Employee system access details retrieved'
      )
    );
  }),

  // 4. Grant Access to Module / Permissions
  grantAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can grant system access');

    const user = await User.findById(req.params.id);
    if (!user) throw createNotFoundError('Employee not found');

    const { moduleKey, moduleName, permissions, reason } = req.body;
    if (!moduleKey) throw createValidationError('Module key is required');

    const normKey = moduleKey.toLowerCase();
    const oldStatus = user.accessStatus;

    // Remove from restricted modules if present
    user.restrictedModules = (user.restrictedModules || []).filter((m) => m.toLowerCase() !== normKey);

    // If user was Revoked, set to Restricted (only this module active) or Active if no other restrictions
    if (user.accessStatus === 'Revoked') {
      user.accessStatus = user.restrictedModules.length > 0 ? 'Restricted' : 'Active';
    } else if (user.accessStatus === 'Restricted' && user.restrictedModules.length === 0) {
      user.accessStatus = 'Active';
    }

    if (permissions && typeof permissions === 'object') {
      if (!user.customPermissions) {
        user.customPermissions = new Map();
      }
      const existing = user.customPermissions instanceof Map
        ? (user.customPermissions.get(normKey) || {})
        : (user.customPermissions[normKey] || {});
      const updated = { ...existing, ...permissions };
      if (user.customPermissions instanceof Map) {
        user.customPermissions.set(normKey, updated);
      } else {
        user.customPermissions[normKey] = updated;
      }
    }

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Admin';

    user.lastAccessChange = {
      action: 'Access Granted',
      date: new Date(),
      performedByName: hrName,
    };

    await user.save();

    // Persist Audit Record
    await AccessAudit.create({
      employee: user._id,
      employeeName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      employeeId: user.jobDetails?.employeeId || '',
      department: user.department || '',
      designation: user.designation || '',
      role: user.role || 'employee',
      moduleKey,
      moduleName: moduleName || moduleKey,
      permission: permissions ? Object.keys(permissions).join(', ') : 'Full Access',
      previousStatus: oldStatus,
      newStatus: 'Active',
      action: 'Access Granted',
      reason: reason || 'Access granted by HR administrator',
      performedBy: req.user.userId,
      performedByName: hrName,
      date: new Date(),
    });

    res.json(successResponse(user, `Access granted for module ${moduleName || moduleKey}`));
  }),

  // 5. Restrict Access to Selected Module(s)
  restrictAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const user = await User.findById(req.params.id);
    if (!user) throw createNotFoundError('Employee not found');

    const { moduleKeys, moduleName, reason } = req.body;
    const keysToAdd = Array.isArray(moduleKeys) ? moduleKeys : [req.body.moduleKey].filter(Boolean);

    if (keysToAdd.length === 0) throw createValidationError('At least one module must be selected');

    const oldStatus = user.accessStatus;
    const currentRestricted = new Set((user.restrictedModules || []).map((m) => m.toLowerCase()));

    for (const k of keysToAdd) {
      currentRestricted.add(k.toLowerCase());
    }

    user.restrictedModules = Array.from(currentRestricted);
    user.accessStatus = 'Restricted';

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Admin';

    user.lastAccessChange = {
      action: 'Access Restricted',
      date: new Date(),
      performedByName: hrName,
    };

    await user.save();

    // Persist Audit Record
    for (const k of keysToAdd) {
      await AccessAudit.create({
        employee: user._id,
        employeeName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        employeeId: user.jobDetails?.employeeId || '',
        department: user.department || '',
        designation: user.designation || '',
        role: user.role || 'employee',
        moduleKey: k,
        moduleName: moduleName || k,
        previousStatus: oldStatus,
        newStatus: 'Restricted',
        action: 'Access Restricted',
        reason: reason || 'Module restricted by HR policy',
        performedBy: req.user.userId,
        performedByName: hrName,
        date: new Date(),
      });
    }

    res.json(successResponse(user, 'Selected module access restricted successfully'));
  }),

  // 6. Revoke Access to Selected Module(s)
  revokeAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const user = await User.findById(req.params.id);
    if (!user) throw createNotFoundError('Employee not found');

    const { moduleKeys, moduleName, reason } = req.body;
    const keysToRevoke = Array.isArray(moduleKeys) ? moduleKeys : [req.body.moduleKey].filter(Boolean);

    if (keysToRevoke.length === 0) throw createValidationError('At least one module must be selected');

    const oldStatus = user.accessStatus;
    const currentRestricted = new Set((user.restrictedModules || []).map((m) => m.toLowerCase()));

    for (const k of keysToRevoke) {
      currentRestricted.add(k.toLowerCase());
    }

    user.restrictedModules = Array.from(currentRestricted);
    user.accessStatus = 'Restricted';

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Admin';

    user.lastAccessChange = {
      action: 'Access Revoked',
      date: new Date(),
      performedByName: hrName,
    };

    await user.save();

    // Persist Audit Record
    for (const k of keysToRevoke) {
      await AccessAudit.create({
        employee: user._id,
        employeeName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        employeeId: user.jobDetails?.employeeId || '',
        department: user.department || '',
        designation: user.designation || '',
        role: user.role || 'employee',
        moduleKey: k,
        moduleName: moduleName || k,
        previousStatus: oldStatus,
        newStatus: 'Revoked',
        action: 'Access Revoked',
        reason: reason || 'Access revoked by HR management',
        performedBy: req.user.userId,
        performedByName: hrName,
        date: new Date(),
      });
    }

    res.json(successResponse(user, 'Selected module access revoked successfully'));
  }),

  // 7. Revoke All Access (Complete Real Backend Operation)
  revokeAllAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can revoke all system access');

    const user = await User.findById(req.params.id);
    if (!user) throw createNotFoundError('Employee not found');

    const { reason } = req.body;
    const oldStatus = user.accessStatus;

    // Fetch all operational modules to restrict
    const activeModules = await Module.find({ status: 'Active' }).select('key').lean();
    const allKeys = (activeModules.length > 0 ? activeModules : RBAC_MODULES).map((m) => m.key.toLowerCase());

    user.accessStatus = 'Revoked';
    user.restrictedModules = allKeys;
    if (user.customPermissions instanceof Map) {
      user.customPermissions.clear();
    } else {
      user.customPermissions = {};
    }

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Admin';

    user.lastAccessChange = {
      action: 'All Access Revoked',
      date: new Date(),
      performedByName: hrName,
    };

    await user.save();

    // Persist Audit Record
    await AccessAudit.create({
      employee: user._id,
      employeeName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      employeeId: user.jobDetails?.employeeId || '',
      department: user.department || '',
      designation: user.designation || '',
      role: user.role || 'employee',
      moduleKey: 'ALL_MODULES',
      moduleName: 'All System Modules',
      permission: 'All Revoked',
      previousStatus: oldStatus,
      newStatus: 'Revoked',
      action: 'All Access Revoked',
      reason: reason || 'All system access revoked by administrator',
      performedBy: req.user.userId,
      performedByName: hrName,
      date: new Date(),
    });

    res.json(successResponse(user, 'All system access successfully revoked'));
  }),

  // 8. Restore Access
  restoreAccess: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const user = await User.findById(req.params.id);
    if (!user) throw createNotFoundError('Employee not found');

    const { reason } = req.body;
    const oldStatus = user.accessStatus;

    user.accessStatus = 'Active';
    user.restrictedModules = [];

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Admin';

    user.lastAccessChange = {
      action: 'Access Restored',
      date: new Date(),
      performedByName: hrName,
    };

    await user.save();

    // Persist Audit Record
    await AccessAudit.create({
      employee: user._id,
      employeeName: user.personalInfo?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      employeeId: user.jobDetails?.employeeId || '',
      department: user.department || '',
      designation: user.designation || '',
      role: user.role || 'employee',
      moduleKey: 'ALL_MODULES',
      moduleName: 'All System Modules',
      permission: 'Restored',
      previousStatus: oldStatus,
      newStatus: 'Active',
      action: 'Access Restored',
      reason: reason || 'Access restored by administrator',
      performedBy: req.user.userId,
      performedByName: hrName,
      date: new Date(),
    });

    res.json(successResponse(user, 'System access restored successfully to Active'));
  }),

  // 9. Centralized Audit History
  getAuditTrail: asyncHandler(async (req, res) => {
    const { employeeId, action } = req.query;
    const filter = {};

    if (employeeId) filter.employee = employeeId;
    if (action && action !== 'All') filter.action = action;

    const audits = await AccessAudit.find(filter)
      .sort({ date: -1 })
      .limit(100)
      .lean();

    res.json(successResponse(audits, 'Access audit history retrieved'));
  }),
};
