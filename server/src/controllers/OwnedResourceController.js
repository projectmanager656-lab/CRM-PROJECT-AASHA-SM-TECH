import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createOwnedResourceController = (service, label) => ({
  create: asyncHandler(async (req, res) => res.status(201).json(createdResponse(await service.create(req.body, req.user), `${label} created`))),
  list: asyncHandler(async (req, res) => res.json(successResponse(await service.list(req.query, req.user), `${label} list retrieved`))),
  get: asyncHandler(async (req, res) => res.json(successResponse(await service.get(req.params.id, req.user), `${label} retrieved`))),
  update: asyncHandler(async (req, res) => res.json(successResponse(await service.update(req.params.id, req.body, req.user), `${label} updated`))),
  remove: asyncHandler(async (req, res) => res.json(successResponse(await service.remove(req.params.id, req.user), `${label} deleted`))),
});
