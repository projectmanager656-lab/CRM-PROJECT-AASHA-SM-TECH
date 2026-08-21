import { Router } from 'express';
import Client from '../models/Client.js';
import Lead from '../models/Lead.js';
import Project from '../models/Project.js';
import { createOwnedResourceController } from '../controllers/OwnedResourceController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';
import { OwnedResourceService } from '../services/OwnedResourceService.js';

const definitions = {
  projects: [Project, ['name', 'description', 'category', 'status', 'startDate', 'dueDate', 'owner', 'sharedWith'], ['name', 'category'], 'Project'],
  leads: [Lead, ['name', 'email', 'phone', 'company', 'source', 'status', 'notes', 'decisionMaker', 'location', 'category', 'websiteStatus', 'instagramStatus', 'gmbStatus', 'requirement', 'lastContact', 'nextFollowUp', 'proposalValue', 'result', 'owner', 'sharedWith'], ['name', 'email'], 'Lead'],
  clients: [Client, ['name', 'email', 'phone', 'company', 'address', 'status', 'owner', 'sharedWith'], ['name', 'email'], 'Client'],
};

export const ownedResourceRouters = Object.fromEntries(Object.entries(definitions).map(([key, [Model, fields, required, label]]) => {
  const router = Router();
  const controller = createOwnedResourceController(new OwnedResourceService(Model, fields, required), label);
  router.use(authenticateToken);
  const moduleKey = key === 'projects' ? 'projects' : 'crm';
  const resourceKey = key;
  router.route('/').get(requirePermission(moduleKey, resourceKey, 'view'), controller.list).post(requirePermission(moduleKey, resourceKey, 'create'), controller.create);
  router.route('/:id').get(requirePermission(moduleKey, resourceKey, 'view'), controller.get).put(requirePermission(moduleKey, resourceKey, 'edit'), controller.update).patch(requirePermission(moduleKey, resourceKey, 'edit'), controller.update).delete(requirePermission(moduleKey, resourceKey, 'delete'), controller.remove);
  return [key, router];
}));
