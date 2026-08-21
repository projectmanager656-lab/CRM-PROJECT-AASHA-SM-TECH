import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import Admin from '../src/models/Admin.js';
import SuperAdmin from '../src/models/SuperAdmin.js';
import User from '../src/models/User.js';
import Role from '../src/models/Role.js';
import RbacModule from '../src/models/Module.js';
import RolePermission from '../src/models/RolePermission.js';
import {
  RBAC_ACTION_KEYS,
  RBAC_MODULES,
  RBAC_ROLE_DEFAULTS,
  RBAC_ROLE_KEYS,
  RBAC_ROLE_TEMPLATES,
  buildActionState,
  getAllModuleKeys,
} from '../src/config/rbacCatalog.js';

const roleIndexByKey = new Map();

const toPlainObject = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

const updateOrCreateRole = async (roleSeed) => {
  const existing = await Role.findOne({ key: roleSeed.key });
  const update = {
    name: roleSeed.name,
    description: roleSeed.description,
    type: roleSeed.type,
    status: roleSeed.status,
    isProtected: roleSeed.isProtected,
    isSystem: roleSeed.isSystem,
    sortOrder: roleSeed.sortOrder,
    metadata: {
      ...(existing?.metadata ? toPlainObject(existing.metadata) : {}),
      seedSource: 'seedRbacFoundation',
    },
  };

  if (roleSeed.parentKey) {
    const parent = roleIndexByKey.get(roleSeed.parentKey);
    if (parent?._id) {
      update.parentRoleId = parent._id;
    }
  } else {
    update.parentRoleId = null;
  }

  const role = await Role.findOneAndUpdate(
    { key: roleSeed.key },
    {
      $set: update,
      $setOnInsert: {
        key: roleSeed.key,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  roleIndexByKey.set(role.key, role);
  return role;
};

const updateOrCreateModule = async (moduleSeed) => {
  const existing = await RbacModule.findOne({ key: moduleSeed.key });
  const module = await RbacModule.findOneAndUpdate(
    { key: moduleSeed.key },
    {
      $set: {
        name: moduleSeed.name,
        slug: moduleSeed.slug,
        description: moduleSeed.description,
        icon: moduleSeed.icon,
        category: moduleSeed.category,
        status: 'Active',
        sidebarVisible: moduleSeed.sidebarVisible,
        displayOrder: moduleSeed.displayOrder,
        dependencies: moduleSeed.dependencies,
        features: moduleSeed.features,
        resources: moduleSeed.resources.map((item, index) => ({
          key: item.key,
          name: item.name,
          path: item.path,
          paths: item.paths,
          description: item.description,
          actions: item.actions,
          sidebarVisible: item.sidebarVisible,
          displayOrder: item.displayOrder || index + 1,
        })),
        metadata: {
          ...(existing?.metadata ? toPlainObject(existing.metadata) : {}),
          seedSource: 'seedRbacFoundation',
        },
      },
      $setOnInsert: {
        key: moduleSeed.key,
        slug: moduleSeed.slug,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return module;
};

const buildPermissionDoc = (roleKey, moduleDoc) => {
  const template = RBAC_ROLE_TEMPLATES[roleKey];
  const moduleEnabled = template?.moduleEnabled(moduleDoc.key) || false;
  const resources = moduleDoc.resources.map((resourceDoc) => {
    const allowedActions = moduleEnabled
      ? template.resourceActions({
        moduleKey: moduleDoc.key,
        resourceKey: resourceDoc.key,
      })
      : [];

    return {
      resourceKey: resourceDoc.key,
      resourceName: resourceDoc.name,
      resourcePath: resourceDoc.path,
      resourcePaths: resourceDoc.paths || [],
      actions: buildActionState(allowedActions),
    };
  });

  return {
    roleKey,
    moduleKey: moduleDoc.key,
    moduleEnabled,
    resources,
  };
};

const seedRolePermissions = async (roleDoc, modules) => {
  let createdOrUpdatedCount = 0;

  for (const moduleDoc of modules) {
    const payload = buildPermissionDoc(roleDoc.key, moduleDoc);
    const result = await RolePermission.findOneAndUpdate(
      { roleId: roleDoc._id, moduleId: moduleDoc._id },
      {
        $set: {
          roleKey: payload.roleKey,
          moduleKey: payload.moduleKey,
          moduleEnabled: payload.moduleEnabled,
          resourcePermissions: payload.resources.map((resource) => ({
            resourceKey: resource.resourceKey,
            resourceName: resource.resourceName,
            resourcePath: resource.resourcePath,
            resourcePaths: resource.resourcePaths,
            actions: resource.actions,
          })),
          metadata: {
            seedSource: 'seedRbacFoundation',
          },
        },
        $setOnInsert: {
          roleId: roleDoc._id,
          moduleId: moduleDoc._id,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (result) createdOrUpdatedCount += 1;
  }

  return createdOrUpdatedCount;
};

const backfillAccountRoleReferences = async (roleDocs) => {
  const roleByKey = new Map(roleDocs.map((role) => [role.key, role]));
  const updates = [
    { Model: User, roleKey: 'employee' },
    { Model: Admin, roleKey: 'admin' },
    { Model: SuperAdmin, roleKey: 'super_admin' },
  ];

  for (const { Model, roleKey } of updates) {
    const role = roleByKey.get(roleKey);
    if (!role) {
      throw new Error(`Missing RBAC role: ${roleKey}`);
    }

    await Model.updateMany(
      {},
      {
        $set: {
          rbacRoleId: role._id,
          rbacRoleKey: role.key,
        },
      }
    );
  }
};

const main = async () => {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  await connectDB();

  const roleDocs = [];
  for (const roleSeed of RBAC_ROLE_DEFAULTS) {
    const role = await updateOrCreateRole(roleSeed);
    roleDocs.push(role);
  }

  const moduleDocs = [];
  for (const moduleSeed of RBAC_MODULES) {
    const moduleDoc = await updateOrCreateModule(moduleSeed);
    moduleDocs.push(moduleDoc);
  }

  const permissionCounts = [];
  for (const roleDoc of roleDocs) {
    const count = await seedRolePermissions(roleDoc, moduleDocs);
    permissionCounts.push({ roleKey: roleDoc.key, modulePermissions: count });
  }

  await backfillAccountRoleReferences(roleDocs);

  const totals = {
    roles: roleDocs.length,
    modules: moduleDocs.length,
    resources: moduleDocs.reduce((sum, moduleDoc) => sum + moduleDoc.resources.length, 0),
    rolePermissions: permissionCounts.reduce((sum, item) => sum + item.modulePermissions, 0),
    actionSlots: moduleDocs.reduce(
      (sum, moduleDoc) => sum + moduleDoc.resources.reduce((resourceSum, resourceDoc) => resourceSum + resourceDoc.actions.length, 0),
      0
    ),
  };

  console.log('RBAC foundation seeded successfully.');
  console.log(`Roles: ${totals.roles}`);
  console.log(`Modules: ${totals.modules}`);
  console.log(`Resources: ${totals.resources}`);
  console.log(`Role permissions: ${totals.rolePermissions}`);
  console.log(`Action slots tracked: ${totals.actionSlots}`);
  console.log(`Seeded roles: ${RBAC_ROLE_KEYS.join(', ')}`);
  console.log(`Seeded modules: ${getAllModuleKeys().join(', ')}`);
  console.log(
    `Permission matrix built with ${RBAC_ACTION_KEYS.length} canonical action keys: ${RBAC_ACTION_KEYS.join(', ')}`
  );
  permissionCounts.forEach((item) => {
    console.log(`- ${item.roleKey}: ${item.modulePermissions} module permission docs`);
  });
};

try {
  await main();
} catch (error) {
  console.error(`RBAC seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await disconnectDB();
  }
}
