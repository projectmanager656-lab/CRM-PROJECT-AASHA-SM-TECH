import Module from '../models/Module.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import SuperAdmin from '../models/SuperAdmin.js';
import { RbacService } from '../services/RbacService.js';
import { RBAC_MODULES, RBAC_ROLE_DEFAULTS, RBAC_ROLE_TEMPLATES, buildActionState } from '../config/rbacCatalog.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

async function ensureRbacCatalog() {
  for (const definition of RBAC_MODULES) {
    await Module.findOneAndUpdate({ key: definition.key }, { $setOnInsert: { ...definition, status: 'Active' } }, { upsert: true, new: true });
  }
  for (const definition of RBAC_ROLE_DEFAULTS) {
    await Role.findOneAndUpdate({ key: definition.key }, { $setOnInsert: { ...definition, parentKey: undefined } }, { upsert: true, new: true });
  }
  const roles = await Role.find({ key: { $in: RBAC_ROLE_DEFAULTS.map((role) => role.key) } });
  const byKey = Object.fromEntries(roles.map((role) => [role.key, role]));
  for (const definition of RBAC_ROLE_DEFAULTS) {
    if (definition.parentKey && byKey[definition.key]) {
      await Role.updateOne({ _id: byKey[definition.key]._id }, { parentRoleId: byKey[definition.parentKey]?._id || null });
    }
  }
  const modules = await Module.find({});
  for (const role of roles) {
    const template = RBAC_ROLE_TEMPLATES[role.key];
    if (!template) continue;
    for (const module of modules) {
      const resources = module.resources.map((resource) => ({
        resourceKey: resource.key, resourceName: resource.name, resourcePath: resource.path,
        resourcePaths: resource.paths, actions: buildActionState(template.resourceActions({ resourceKey: resource.key, moduleKey: module.key })),
      }));
      await RolePermission.findOneAndUpdate(
        { roleId: role._id, moduleId: module._id },
        { $setOnInsert: { roleId: role._id, roleKey: role.key, moduleId: module._id, moduleKey: module.key, moduleEnabled: template.moduleEnabled(module.key), resourcePermissions: resources } },
        { upsert: true, new: true }
      );
    }
  }
}

const serializeRole = (role, permissions, userCount) => ({
  ...role.toJSON(),
  usersCount: userCount,
  modulesCount: permissions.filter((permission) => permission.moduleEnabled).length,
  permissionsCount: permissions.reduce((total, permission) => total + permission.resourcePermissions.reduce((sum, resource) => sum + Object.values(resource.actions || {}).filter(Boolean).length, 0), 0),
});

export class RbacController {
  static listAccounts = asyncHandler(async (_req, res) => {
    const [employees, admins, superAdmins] = await Promise.all([
      User.find({}).select('firstName lastName email department isActive rbacRoleId rbacRoleKey createdAt').lean(),
      Admin.find({}).select('firstName lastName email isActive rbacRoleId rbacRoleKey createdAt').lean(),
      SuperAdmin.find({}).select('firstName lastName email isActive rbacRoleId rbacRoleKey createdAt').lean(),
    ]);
    const accounts = [
      ...employees.map((account) => ({ ...account, accountType: 'employee' })),
      ...admins.map((account) => ({ ...account, accountType: 'admin' })),
      ...superAdmins.map((account) => ({ ...account, accountType: 'super_admin' })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(successResponse(accounts, 'Accounts retrieved successfully'));
  });

  static listRoles = asyncHandler(async (_req, res) => {
    await ensureRbacCatalog();
    const [roles, permissions, employeeCounts, adminCounts, superAdminCounts] = await Promise.all([Role.find({}).sort({ sortOrder: 1, name: 1 }), RolePermission.find({}), User.aggregate([{ $match: { rbacRoleId: { $ne: null } } }, { $group: { _id: '$rbacRoleId', count: { $sum: 1 } } }]), Admin.aggregate([{ $match: { rbacRoleId: { $ne: null } } }, { $group: { _id: '$rbacRoleId', count: { $sum: 1 } } }]), SuperAdmin.aggregate([{ $match: { rbacRoleId: { $ne: null } } }, { $group: { _id: '$rbacRoleId', count: { $sum: 1 } } }])]);
    const rolePermissions = permissions.reduce((map, permission) => { (map[permission.roleId] ||= []).push(permission); return map; }, {});
    const counts = [...employeeCounts, ...adminCounts, ...superAdminCounts].reduce((map, item) => ({ ...map, [String(item._id)]: (map[String(item._id)] || 0) + item.count }), {});
    const result = roles.map((role) => serializeRole(role, rolePermissions[role._id] || [], counts[String(role._id)] || 0));
    res.json(successResponse(result, 'Roles retrieved successfully'));
  });

  static listModules = asyncHandler(async (_req, res) => {
    await ensureRbacCatalog();
    res.json(successResponse(await Module.find({}).sort({ displayOrder: 1, name: 1 }), 'Modules retrieved successfully'));
  });

  static getRole = asyncHandler(async (req, res) => {
    await ensureRbacCatalog();
    const role = await Role.findById(req.params.id);
    if (!role) throw createNotFoundError('Role not found');
    const permissions = await RolePermission.find({ roleId: role._id }).sort({ moduleKey: 1 });
    res.json(successResponse({ ...serializeRole(role, permissions, 0), permissions }, 'Role retrieved successfully'));
  });

  static createRole = asyncHandler(async (req, res) => {
    const key = normalizeKey(req.body.key || req.body.name);
    if (!key || !req.body.name?.trim()) throw createValidationError('Role name is required');
    if (await Role.exists({ key })) throw createValidationError('A role with this name already exists');
    const role = await Role.create({ key, name: req.body.name.trim(), description: String(req.body.description || '').trim(), type: 'custom', status: 'Active', sortOrder: Number(req.body.sortOrder) || 99 });
    const modules = await Module.find({}).sort({ displayOrder: 1 });
    await RolePermission.insertMany(modules.map((module) => ({ roleId: role._id, roleKey: role.key, moduleId: module._id, moduleKey: module.key, moduleEnabled: false, resourcePermissions: module.resources.map((resource) => ({ resourceKey: resource.key, resourceName: resource.name, resourcePath: resource.path, resourcePaths: resource.paths, actions: buildActionState([]) })) })));
    res.status(201).json(createdResponse(role, 'Role created successfully'));
  });

  static updateRole = asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) throw createNotFoundError('Role not found');
    if (req.body.name !== undefined) role.name = String(req.body.name).trim();
    if (req.body.description !== undefined) role.description = String(req.body.description).trim();
    if (req.body.status !== undefined) role.status = req.body.status;
    await role.save();
    res.json(successResponse(role, 'Role updated successfully'));
  });

  static updatePermissions = asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) throw createNotFoundError('Role not found');
    if (role.isProtected) throw createForbiddenError('The protected Super Admin role cannot be changed');
    if (!Array.isArray(req.body.permissions)) throw createValidationError('Permissions must be an array');
    const current = await RolePermission.find({ roleId: role._id });
    const allowedModuleIds = new Set(current.map((item) => String(item.moduleId)));
    for (const input of req.body.permissions) {
      if (!allowedModuleIds.has(String(input.moduleId))) throw createValidationError('Invalid module permission');
      const existing = current.find((item) => String(item.moduleId) === String(input.moduleId));
      existing.moduleEnabled = Boolean(input.moduleEnabled);
      for (const resource of input.resourcePermissions || []) {
        const target = existing.resourcePermissions.find((item) => item.resourceKey === resource.resourceKey);
        if (target) target.actions = buildActionState(Object.entries(resource.actions || {}).filter(([, allowed]) => allowed).map(([action]) => action));
      }
      await existing.save();
    }
    res.json(successResponse(await RolePermission.find({ roleId: role._id }), 'Role permissions updated successfully'));
  });

  static assignRole = asyncHandler(async (req, res) => {
    try { const account = await RbacService.assignRole(req.params.accountType, req.params.accountId, req.body.roleId); res.json(successResponse(account, 'RBAC role assigned successfully')); }
    catch (error) { throw createValidationError(error.message); }
  });
}
