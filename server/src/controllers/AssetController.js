import Asset from '../models/Asset.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper to get performer name
const getPerformerName = (user) => {
  if (!user) return 'HR Administrator';
  const name = user.personalInfo?.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'HR Administrator';
};

const getEmployeeFullName = (emp) => {
  if (!emp) return '';
  const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
  return name || emp.email || '';
};

// Auto-generate Asset Code if not provided
const generateAssetCode = async () => {
  const count = await Asset.countDocuments();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const code = `AST-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
  return code.toUpperCase();
};

export const AssetController = {
  // 1. Dynamic KPI Summary
  summary: asyncHandler(async (req, res) => {
    const assets = await Asset.find().lean();

    const totalAssets = assets.length;
    let availableAssets = 0;
    let allocatedAssets = 0;
    let underRepairAssets = 0;
    let lostDamagedAssets = 0;
    let retiredDisposedAssets = 0;
    let totalAssetValue = 0;

    const categoryCounts = {};
    const departmentCounts = {};

    assets.forEach((a) => {
      const status = a.status || 'Available';
      if (status === 'Available' || status === 'Returned') availableAssets += 1;
      else if (status === 'Allocated') allocatedAssets += 1;
      else if (status === 'Under Repair') underRepairAssets += 1;
      else if (status === 'Lost' || status === 'Damaged') lostDamagedAssets += 1;
      else if (status === 'Retired' || status === 'Disposed') retiredDisposedAssets += 1;

      totalAssetValue += Number(a.purchaseCost || 0);

      // Category counts
      const cat = a.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      // Department counts
      if (a.department) {
        departmentCounts[a.department] = (departmentCounts[a.department] || 0) + 1;
      }
    });

    res.json(
      successResponse(
        {
          totalAssets,
          availableAssets,
          allocatedAssets,
          underRepairAssets,
          lostDamagedAssets,
          retiredDisposedAssets,
          totalAssetValue,
          categoryCounts,
          departmentCounts,
        },
        'Asset summary retrieved successfully'
      )
    );
  }),

  // 2. List Assets with Search, Filters & Pagination
  list: asyncHandler(async (req, res) => {
    const {
      search,
      category,
      status,
      condition,
      department,
      assignedTo,
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Status filter
    if (status && status !== 'All') {
      if (status === 'Available') {
        query.status = { $in: ['Available', 'Returned'] };
      } else if (status === 'Lost_Damaged' || status === 'Lost/Damaged') {
        query.status = { $in: ['Lost', 'Damaged'] };
      } else if (status === 'Retired_Disposed' || status === 'Retired/Disposed') {
        query.status = { $in: ['Retired', 'Disposed'] };
      } else {
        query.status = status;
      }
    }

    // Condition filter
    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    // Department filter
    if (department && department !== 'All') {
      query.department = department;
    }

    // Assigned Employee filter
    if (assignedTo && assignedTo !== 'All') {
      query.assignedTo = assignedTo;
    }

    // Search query
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const userMatches = await User.find({
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { 'personalInfo.fullName': { $regex: q, $options: 'i' } },
          { 'jobDetails.employeeId': { $regex: q, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean();

      const userIds = userMatches.map((u) => u._id);

      query.$or = [
        { assetName: { $regex: q, $options: 'i' } },
        { assetCode: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } },
        { serialNumber: { $regex: q, $options: 'i' } },
        { vendor: { $regex: q, $options: 'i' } },
        { assignedTo: { $in: userIds } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await Asset.countDocuments(query);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const assets = await Asset.find(query)
      .populate('assignedTo', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json(
      successResponse(
        {
          assets,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
        'Assets retrieved successfully'
      )
    );
  }),

  // 3. Get Single Asset Details with Full History
  get: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await Asset.findById(id)
      .populate('assignedTo', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.performedBy', 'firstName lastName email')
      .populate('history.employee', 'firstName lastName email jobDetails')
      .lean();

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    res.json(successResponse(asset, 'Asset details retrieved successfully'));
  }),

  // 4. Create New Asset
  create: asyncHandler(async (req, res) => {
    const {
      assetName,
      assetCode: customCode,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchaseCost,
      vendor,
      warrantyStart,
      warrantyExpiry,
      condition = 'Good',
      location = 'Headquarters / Main Office',
      description,
      notes,
    } = req.body;

    if (!assetName || !String(assetName).trim()) {
      throw createValidationError('Asset Name is required');
    }

    let code = customCode ? String(customCode).trim().toUpperCase() : await generateAssetCode();

    const existingCode = await Asset.findOne({ assetCode: code });
    if (existingCode) {
      if (customCode) {
        throw createValidationError(`Asset code "${code}" already exists.`);
      }
      code = await generateAssetCode();
    }

    const performerName = getPerformerName(req.user);

    const asset = new Asset({
      assetName: String(assetName).trim(),
      assetCode: code,
      category: category || 'Laptop',
      brand: brand ? String(brand).trim() : '',
      model: model ? String(model).trim() : '',
      serialNumber: serialNumber ? String(serialNumber).trim() : '',
      purchaseDate: purchaseDate || null,
      purchaseCost: purchaseCost ? Number(purchaseCost) : 0,
      vendor: vendor ? String(vendor).trim() : '',
      warrantyStart: warrantyStart || null,
      warrantyExpiry: warrantyExpiry || null,
      condition,
      status: 'Available',
      assignedTo: null,
      assignedDate: null,
      department: '',
      location: location ? String(location).trim() : 'Headquarters / Main Office',
      description: description ? String(description).trim() : '',
      notes: notes ? String(notes).trim() : '',
      createdBy: req.user?.userId || null,
      createdByName: performerName,
      history: [
        {
          action: 'Created',
          performedBy: req.user?.userId || null,
          performedByName: performerName,
          date: new Date(),
          previousStatus: '',
          newStatus: 'Available',
          condition,
          notes: 'Asset registered in system.',
        },
      ],
    });

    await asset.save();
    res.status(201).json(successResponse(asset, 'Asset created successfully'));
  }),

  // 5. Update Asset Metadata
  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await Asset.findById(id);

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    const {
      assetName,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchaseCost,
      vendor,
      warrantyStart,
      warrantyExpiry,
      condition,
      location,
      description,
      notes,
    } = req.body;

    if (assetName) asset.assetName = String(assetName).trim();
    if (category) asset.category = category;
    if (brand !== undefined) asset.brand = String(brand).trim();
    if (model !== undefined) asset.model = String(model).trim();
    if (serialNumber !== undefined) asset.serialNumber = String(serialNumber).trim();
    if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate || null;
    if (purchaseCost !== undefined) asset.purchaseCost = Number(purchaseCost || 0);
    if (vendor !== undefined) asset.vendor = String(vendor).trim();
    if (warrantyStart !== undefined) asset.warrantyStart = warrantyStart || null;
    if (warrantyExpiry !== undefined) asset.warrantyExpiry = warrantyExpiry || null;
    if (condition) asset.condition = condition;
    if (location !== undefined) asset.location = String(location).trim();
    if (description !== undefined) asset.description = String(description).trim();
    if (notes !== undefined) asset.notes = String(notes).trim();

    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = getPerformerName(req.user);

    asset.history.push({
      action: 'Updated',
      performedBy: req.user?.userId || null,
      performedByName: asset.updatedByName,
      date: new Date(),
      previousStatus: asset.status,
      newStatus: asset.status,
      condition: asset.condition,
      notes: 'Asset specifications/metadata updated.',
    });

    await asset.save();
    res.json(successResponse(asset, 'Asset updated successfully'));
  }),

  // 6. Assign Asset to Employee (Only updates Asset, NEVER modifies User)
  assign: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { employeeId, assignedDate, condition, notes, location } = req.body;

    if (!employeeId) {
      throw createValidationError('Please select an employee to allocate this asset to.');
    }

    const [asset, employee] = await Promise.all([
      Asset.findById(id),
      User.findById(employeeId),
    ]);

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    if (!employee) {
      throw createNotFoundError('Selected employee account not found');
    }

    if (asset.status === 'Allocated') {
      throw createValidationError(`Asset is already allocated to another employee. Please return or transfer it.`);
    }

    if (asset.status === 'Lost' || asset.status === 'Retired' || asset.status === 'Disposed') {
      throw createValidationError(`Asset cannot be allocated while in "${asset.status}" status.`);
    }

    const previousStatus = asset.status;
    const performerName = getPerformerName(req.user);
    const empName = getEmployeeFullName(employee);

    asset.status = 'Allocated';
    asset.assignedTo = employee._id;
    asset.assignedDate = assignedDate ? new Date(assignedDate) : new Date();
    asset.department = employee.jobDetails?.department || employee.department || 'General';
    if (location) asset.location = String(location).trim();
    if (condition) asset.condition = condition;
    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    asset.history.push({
      action: 'Assigned',
      performedBy: req.user?.userId || null,
      performedByName: performerName,
      employee: employee._id,
      employeeName: empName,
      date: asset.assignedDate,
      previousStatus,
      newStatus: 'Allocated',
      condition: asset.condition,
      notes: notes || `Allocated to ${empName} (${employee.jobDetails?.employeeId || 'Staff'})`,
    });

    await asset.save();

    // Notify employee
    try {
      await Notification.create({
        recipient: employee._id,
        title: 'Asset Allocated',
        message: `Asset "${asset.assetName}" (${asset.assetCode}) has been allocated to you by HR.`,
        type: 'Info',
        isRead: false,
      });
    } catch (e) {
      // Non-blocking notification
    }

    const populated = await Asset.findById(asset._id).populate('assignedTo', 'firstName lastName email department designation jobDetails personalInfo');
    res.json(successResponse(populated, `Asset successfully allocated to ${empName}`));
  }),

  // 7. Return Asset to Stock
  returnToStock: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { condition, returnDate, notes, location = 'Headquarters / Main Office' } = req.body;

    const asset = await Asset.findById(id).populate('assignedTo', 'firstName lastName email jobDetails personalInfo');

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    const previousStatus = asset.status;
    const previousEmployee = asset.assignedTo;
    const previousEmpName = getEmployeeFullName(previousEmployee);
    const performerName = getPerformerName(req.user);

    asset.status = 'Returned';
    asset.assignedTo = null;
    asset.assignedDate = null;
    asset.department = '';
    asset.location = String(location).trim();
    if (condition) asset.condition = condition;
    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    asset.history.push({
      action: 'Returned',
      performedBy: req.user?.userId || null,
      performedByName: performerName,
      employee: previousEmployee?._id || null,
      employeeName: previousEmpName,
      date: returnDate ? new Date(returnDate) : new Date(),
      previousStatus,
      newStatus: 'Returned',
      condition: asset.condition,
      notes: notes || `Returned from ${previousEmpName || 'employee'} to inventory.`,
    });

    await asset.save();

    // Notify previous employee
    if (previousEmployee?._id) {
      try {
        await Notification.create({
          recipient: previousEmployee._id,
          title: 'Asset Returned',
          message: `Asset "${asset.assetName}" (${asset.assetCode}) return has been confirmed by HR.`,
          type: 'Success',
          isRead: false,
        });
      } catch (e) {
        // Non-blocking
      }
    }

    res.json(successResponse(asset, 'Asset returned to inventory successfully'));
  }),

  // 8. Maintenance / Repair Workflow
  maintenance: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { actionType = 'start', issueDescription, cost = 0, condition, notes, location } = req.body;

    const asset = await Asset.findById(id);

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    const previousStatus = asset.status;
    const performerName = getPerformerName(req.user);

    if (actionType === 'start') {
      asset.status = 'Under Repair';
      if (condition) asset.condition = condition;
      if (location) asset.location = String(location).trim();

      asset.history.push({
        action: 'Maintenance Started',
        performedBy: req.user?.userId || null,
        performedByName: performerName,
        date: new Date(),
        previousStatus,
        newStatus: 'Under Repair',
        condition: asset.condition,
        notes: issueDescription || notes || 'Sent for maintenance / hardware repair.',
      });
    } else {
      // Completed maintenance -> returns to Available
      asset.status = 'Available';
      if (condition) asset.condition = condition;
      else asset.condition = 'Good';

      asset.history.push({
        action: 'Maintenance Completed',
        performedBy: req.user?.userId || null,
        performedByName: performerName,
        date: new Date(),
        previousStatus,
        newStatus: 'Available',
        condition: asset.condition,
        notes: notes || `Maintenance completed. Repair cost: ₹${cost}`,
      });
    }

    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    await asset.save();
    res.json(successResponse(asset, `Asset maintenance status updated successfully`));
  }),

  // 9. Transfer Asset Between Employees (Never modifies User documents)
  transfer: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { targetEmployeeId, transferDate, condition, notes } = req.body;

    if (!targetEmployeeId) {
      throw createValidationError('Target employee is required for asset transfer.');
    }

    const [asset, newEmployee] = await Promise.all([
      Asset.findById(id).populate('assignedTo', 'firstName lastName email jobDetails personalInfo'),
      User.findById(targetEmployeeId),
    ]);

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    if (!newEmployee) {
      throw createNotFoundError('Target employee not found');
    }

    const previousEmployee = asset.assignedTo;
    const previousEmpName = getEmployeeFullName(previousEmployee);
    const newEmpName = getEmployeeFullName(newEmployee);
    const performerName = getPerformerName(req.user);

    asset.status = 'Allocated';
    asset.assignedTo = newEmployee._id;
    asset.assignedDate = transferDate ? new Date(transferDate) : new Date();
    asset.department = newEmployee.jobDetails?.department || newEmployee.department || 'General';
    if (condition) asset.condition = condition;
    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    asset.history.push({
      action: 'Transferred',
      performedBy: req.user?.userId || null,
      performedByName: performerName,
      employee: newEmployee._id,
      employeeName: newEmpName,
      date: asset.assignedDate,
      previousStatus: 'Allocated',
      newStatus: 'Allocated',
      condition: asset.condition,
      notes: notes || `Transferred from ${previousEmpName || 'previous employee'} to ${newEmpName}`,
    });

    await asset.save();

    // Notifications
    try {
      if (previousEmployee?._id) {
        await Notification.create({
          recipient: previousEmployee._id,
          title: 'Asset Transferred',
          message: `Asset "${asset.assetName}" (${asset.assetCode}) was transferred to ${newEmpName}.`,
          type: 'Info',
          isRead: false,
        });
      }
      await Notification.create({
        recipient: newEmployee._id,
        title: 'Asset Allocated',
        message: `Asset "${asset.assetName}" (${asset.assetCode}) has been allocated to you by HR.`,
        type: 'Info',
        isRead: false,
      });
    } catch (e) {
      // Non-blocking
    }

    const populated = await Asset.findById(asset._id).populate('assignedTo', 'firstName lastName email department designation jobDetails personalInfo');
    res.json(successResponse(populated, `Asset successfully transferred to ${newEmpName}`));
  }),

  // 10. Mark Asset as Lost or Damaged
  lostOrDamaged: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type = 'Lost', reason, notes } = req.body; // type: 'Lost' | 'Damaged'

    const targetStatus = type === 'Damaged' ? 'Damaged' : 'Lost';
    const actionName = type === 'Damaged' ? 'Marked Damaged' : 'Marked Lost';

    const asset = await Asset.findById(id).populate('assignedTo', 'firstName lastName email jobDetails personalInfo');

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    const previousStatus = asset.status;
    const previousEmployee = asset.assignedTo;
    const performerName = getPerformerName(req.user);

    asset.status = targetStatus;
    if (targetStatus === 'Damaged') asset.condition = 'Damaged';
    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    asset.history.push({
      action: actionName,
      performedBy: req.user?.userId || null,
      performedByName: performerName,
      employee: previousEmployee?._id || null,
      employeeName: getEmployeeFullName(previousEmployee),
      date: new Date(),
      previousStatus,
      newStatus: targetStatus,
      condition: asset.condition,
      notes: reason || notes || `Asset marked as ${targetStatus}.`,
    });

    await asset.save();
    res.json(successResponse(asset, `Asset marked as ${targetStatus} successfully`));
  }),

  // 11. Retire or Dispose Asset (Preserves complete historical record)
  retireOrDispose: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type = 'Retired', reason, notes, disposalDetails } = req.body; // type: 'Retired' | 'Disposed'

    const targetStatus = type === 'Disposed' ? 'Disposed' : 'Retired';
    const actionName = targetStatus;

    const asset = await Asset.findById(id).populate('assignedTo', 'firstName lastName email jobDetails personalInfo');

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    const previousStatus = asset.status;
    const previousEmployee = asset.assignedTo;
    const performerName = getPerformerName(req.user);

    asset.status = targetStatus;
    asset.assignedTo = null;
    asset.assignedDate = null;
    asset.updatedBy = req.user?.userId || null;
    asset.updatedByName = performerName;

    asset.history.push({
      action: actionName,
      performedBy: req.user?.userId || null,
      performedByName: performerName,
      employee: previousEmployee?._id || null,
      employeeName: getEmployeeFullName(previousEmployee),
      date: new Date(),
      previousStatus,
      newStatus: targetStatus,
      condition: asset.condition,
      notes: notes || reason || disposalDetails || `Asset marked as ${targetStatus}.`,
    });

    await asset.save();
    res.json(successResponse(asset, `Asset marked as ${targetStatus} successfully`));
  }),

  // 12. Delete Asset (Safeguarded: Disallowed if historical allocations/usage exist)
  remove: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await Asset.findById(id);

    if (!asset) {
      throw createNotFoundError('Asset not found');
    }

    // Check if asset has historical allocation or maintenance events
    const significantHistory = (asset.history || []).filter(
      (h) => h.action !== 'Created' && h.action !== 'Updated'
    );

    if (significantHistory.length > 0 || asset.status === 'Allocated') {
      throw createForbiddenError(
        `Cannot permanently delete asset "${asset.assetCode}" because it has active/historical records. Please use "Retire" or "Dispose" instead to preserve audit trail.`
      );
    }

    await Asset.findByIdAndDelete(id);
    res.json(successResponse({ id }, `Unallocated asset "${asset.assetCode}" deleted successfully.`));
  }),
};
