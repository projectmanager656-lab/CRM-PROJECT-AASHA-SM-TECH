import CompanySetting from '../models/CompanySetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import { createForbiddenError } from '../utils/apiError.js';

const allowed = ['companyName','companyContact','officeAddress','requiredWorkingHours','allowedIpAddresses','enableIpValidation','officeLatitude','officeLongitude','allowedGpsRadius','enableGpsValidation','enableAttendancePhoto'];
const getSetting = () => CompanySetting.findOneAndUpdate({ key: 'company' }, { $setOnInsert: { key: 'company' } }, { new: true, upsert: true, setDefaultsOnInsert: true });
export const CompanySettingController = {
  get: asyncHandler(async (_req, res) => res.json(successResponse(await getSetting(), 'Company configuration retrieved'))),
  update: asyncHandler(async (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role)) throw createForbiddenError('Only administrators can update company configuration');
    const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    if (changes.allowedIpAddresses) changes.allowedIpAddresses = changes.allowedIpAddresses.map((ip) => String(ip).trim()).filter(Boolean);
    const setting = await CompanySetting.findOneAndUpdate({ key: 'company' }, { $set: changes, $setOnInsert: { key: 'company' } }, { new: true, upsert: true, runValidators: true });
    res.json(successResponse(setting, 'Company configuration updated'));
  }),
};
