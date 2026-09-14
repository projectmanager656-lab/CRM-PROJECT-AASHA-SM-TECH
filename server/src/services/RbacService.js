import Admin from '../models/Admin.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';
import SuperAdmin from '../models/SuperAdmin.js';
import User from '../models/User.js';

const models = { employee: User, admin: Admin, super_admin: SuperAdmin };

export class RbacService {
  static async accountForToken(tokenUser) {
    const Model = models[tokenUser.role];
    return Model ? Model.findById(tokenUser.userId) : null;
  }

  static async effectivePermissions(tokenUser) {
    if (tokenUser.role === 'super_admin') return { bypass: true, role: { key: 'super_admin', name: 'Super Admin' }, permissions: {} };
    const account = await this.accountForToken(tokenUser);
    // A number of pre-RBAC accounts do not yet have rbacRoleId populated.  Resolve
    // their account-type role so that they are governed by the persisted policy,
    // rather than receiving the former implicit legacy bypass.
    const roleKey = account?.rbacRoleKey || tokenUser.role;
    const role = account?.rbacRoleId ? await Role.findById(account.rbacRoleId) : await Role.findOne({ key: roleKey, status: 'Active' });
    // Permission resolution is deliberately fail-closed. A missing/inactive role
    // must never turn into administrative access.
    if (!role) return { bypass: false, role: null, permissions: {} };

    // If account access is completely Revoked, return zero permissions
    if (account?.accessStatus === 'Revoked') {
      return { bypass: false, role: { id: role._id, key: role.key, name: role.name }, permissions: {} };
    }

    const policies = await RolePermission.find({ roleId: role._id, moduleEnabled: true });
    const permissions = {};
    for (const policy of policies) {
      if (account?.accessStatus === 'Restricted') {
        const restricted = new Set((account.restrictedModules || []).map((m) => String(m).toLowerCase()));
        if (restricted.has(policy.moduleKey.toLowerCase())) continue;
      }
      permissions[policy.moduleKey] ||= {};
      for (const resource of policy.resourcePermissions) permissions[policy.moduleKey][resource.resourceKey] = resource.actions || {};
    }

    // Merge any custom user-level granted permissions
    if (account?.customPermissions) {
      const entries = account.customPermissions instanceof Map
        ? Array.from(account.customPermissions.entries())
        : typeof account.customPermissions.forEach === 'function'
        ? Array.from(account.customPermissions.entries())
        : Object.entries(account.customPermissions);
      for (const [modKey, modPerms] of entries) {
        if (account?.accessStatus === 'Restricted') {
          const restricted = new Set((account.restrictedModules || []).map((m) => String(m).toLowerCase()));
          if (restricted.has(String(modKey).toLowerCase())) continue;
        }
        permissions[modKey] = { ...(permissions[modKey] || {}), ...modPerms };
      }
    }

    return { bypass: false, role: { id: role._id, key: role.key, name: role.name }, permissions };
  }

  static async assignRole(accountType, accountId, roleId) {
    const Model = models[accountType];
    if (!Model) throw new Error('Invalid account type');
    const [account, role] = await Promise.all([Model.findById(accountId), Role.findById(roleId)]);
    if (!account || !role) throw new Error(!account ? 'Account not found' : 'Role not found');
    account.rbacRoleId = role._id; account.rbacRoleKey = role.key;
    await account.save();
    return account.toJSON();
  }
}
