import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import DocumentRequirement from '../models/DocumentRequirement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AccessAudit from '../models/AccessAudit.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const uploadRoot = path.resolve('uploads/documents');

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const getFullName = (user) => {
  if (!user) return 'System User';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.personalInfo?.fullName || user.email || 'HR Manager';
};

// Safe audit logging helper
const logDocumentAudit = async ({
  req,
  targetEmployee,
  action,
  document,
  sensitiveCategory = 'Document Management',
  result = 'SUCCESS',
  reason = '',
}) => {
  try {
    const empUser = targetEmployee || document?.owner;
    const empId = empUser?._id || empUser;
    const empName = empUser ? getFullName(empUser) : 'Employee';
    const dept = empUser?.department || empUser?.jobDetails?.department || document?.department || '';
    const designation = empUser?.designation || empUser?.jobDetails?.designation || '';
    const employeeCode = empUser?.jobDetails?.employeeId || empUser?.employeeId || '';

    await AccessAudit.create({
      employee: empId,
      employeeName: empName,
      employeeId: employeeCode,
      department: dept,
      designation: designation,
      role: empUser?.role || 'employee',
      moduleKey: 'documents',
      moduleName: 'Document Management',
      action: action,
      sensitiveCategory: sensitiveCategory,
      result: result,
      reason: reason || document?.name || '',
      performedBy: req?.user?.userId || null,
      performedByName: getFullName(req?.user),
      ipAddress: req?.ip || req?.socket?.remoteAddress || '',
      userAgent: req?.headers?.['user-agent'] || '',
      date: new Date(),
    });
  } catch (err) {
    // Non-blocking audit logger
    console.error('Audit logging notice:', err.message);
  }
};

const getOwnedDocument = async (id, user) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createValidationError('Invalid document ID');
  }

  const doc = await Document.findById(id)
    .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
    .populate('uploadedBy', 'firstName lastName email department')
    .populate('verifiedBy', 'firstName lastName email department')
    .populate('rejectedBy', 'firstName lastName email department')
    .populate('rootDocument', 'documentId name version createdAt');

  if (!doc) {
    throw createNotFoundError('Document not found');
  }

  if (user.role === 'employee' && user.department !== 'HR' && String(doc.owner?._id || doc.owner) !== String(user.userId)) {
    throw createForbiddenError('Access denied: You can only access your own documents');
  }

  return doc;
};

// Seed standard corporate requirements if none exist
const ensureDefaultRequirements = async (userId, userName) => {
  const count = await DocumentRequirement.countDocuments();
  if (count === 0) {
    const defaults = [
      { name: 'Aadhaar Card', category: 'Identity Proof', documentType: 'Aadhaar Card', isMandatory: true, description: 'Government issued unique identity proof' },
      { name: 'PAN Card', category: 'Identity Proof', documentType: 'PAN Card', isMandatory: true, description: 'Permanent Account Number card for taxation' },
      { name: 'Degree Certificate', category: 'Education Certificate', documentType: 'Degree Certificate', isMandatory: true, description: 'Highest educational qualification degree or diploma' },
      { name: 'Appointment Letter', category: 'Employment', documentType: 'Appointment Letter', isMandatory: true, description: 'Official signed appointment / joining letter' },
      { name: 'Relieving / Experience Letter', category: 'Employment', documentType: 'Relieving Letter', isMandatory: true, description: 'Previous employer relieving / experience document' },
      { name: 'Bank Proof', category: 'Payroll / Financial', documentType: 'Bank Proof', isMandatory: true, description: 'Cancelled cheque or passbook copy for salary credit' },
    ];
    await DocumentRequirement.insertMany(
      defaults.map((d) => ({
        ...d,
        createdBy: userId || null,
        createdByName: userName || 'System Setup',
      }))
    );
  }
};

export const DocumentController = {
  // 1. List documents with dynamic search, filters & pagination
  list: asyncHandler(async (req, res) => {
    const {
      owner,
      department,
      category,
      documentType,
      status,
      expiryStatus,
      search,
      isArchived = 'false',
      page = 1,
      limit = 50,
      sort = '-createdAt',
    } = req.query;

    const filter = {};

    if (isArchived === 'true') {
      filter.isArchived = true;
    } else {
      filter.isArchived = { $ne: true };
    }

    // Employee isolation for non-HR
    if (!isHrOrAdmin(req.user)) {
      filter.owner = req.user.userId;
    } else if (owner && owner !== 'All') {
      filter.owner = owner;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (documentType && documentType !== 'All') {
      filter.documentType = documentType;
    }

    // Status filter
    if (status && status !== 'All') {
      if (status === 'Pending' || status === 'Pending Verification') {
        filter.status = { $in: ['Pending', 'Pending Verification', 'Under Review', 'Re-upload Required'] };
      } else {
        filter.status = status;
      }
    }

    // Expiry Status Filter
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (expiryStatus === 'Expired') {
      filter.expiryDate = { $ne: null, $lt: now };
    } else if (expiryStatus === 'Expiring Soon') {
      filter.expiryDate = { $ne: null, $gte: now, $lte: thirtyDaysAhead };
    } else if (expiryStatus === 'Valid') {
      filter.$or = [{ expiryDate: null }, { expiryDate: { $gt: thirtyDaysAhead } }];
    }

    // Department filtering via User collection
    if (department && department !== 'All') {
      const usersInDept = await User.find({
        role: 'employee',
        $or: [{ department }, { 'jobDetails.department': department }],
      }).select('_id');
      const deptUserIds = usersInDept.map((u) => u._id);
      if (filter.owner) {
        if (!deptUserIds.some((id) => String(id) === String(filter.owner))) {
          return res.json(
            successResponse(
              {
                documents: [],
                pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
              },
              'Documents retrieved'
            )
          );
        }
      } else {
        filter.owner = { $in: deptUserIds };
      }
    }

    // Search query
    if (search && search.trim()) {
      const s = search.trim();
      const matchingUsers = await User.find({
        role: 'employee',
        $or: [
          { firstName: { $regex: s, $options: 'i' } },
          { lastName: { $regex: s, $options: 'i' } },
          { email: { $regex: s, $options: 'i' } },
          { 'personalInfo.fullName': { $regex: s, $options: 'i' } },
          { 'jobDetails.employeeId': { $regex: s, $options: 'i' } },
        ],
      }).select('_id');
      const matchingUserIds = matchingUsers.map((u) => u._id);

      const searchConditions = [
        { documentId: { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { documentNumber: { $regex: s, $options: 'i' } },
        { documentType: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
      ];

      if (matchingUserIds.length > 0) {
        searchConditions.push({ owner: { $in: matchingUserIds } });
      }

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [total, documents] = await Promise.all([
      Document.countDocuments(filter),
      Document.find(filter)
        .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
        .populate('uploadedBy', 'firstName lastName email department')
        .populate('verifiedBy', 'firstName lastName email department')
        .populate('rejectedBy', 'firstName lastName email department')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json(
      successResponse(
        {
          documents,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
        'Documents retrieved'
      )
    );
  }),

  // 2. Summary & KPIs
  summary: asyncHandler(async (req, res) => {
    const filter = { isArchived: { $ne: true } };
    if (!isHrOrAdmin(req.user)) {
      filter.owner = req.user.userId;
    }

    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [allDocs, totalEmployees, requirements] = await Promise.all([
      Document.find(filter).select('status category documentType expiryDate owner').lean(),
      User.countDocuments({ role: 'employee', isActive: true, employmentStatus: { $nin: ['Exited', 'Terminated'] } }),
      DocumentRequirement.find({ isMandatory: true }).lean(),
    ]);

    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let expired = 0;
    let expiringSoon = 0;
    const categoryMap = {};

    allDocs.forEach((doc) => {
      if (['Pending', 'Pending Verification', 'Under Review', 'Re-upload Required'].includes(doc.status)) {
        pending++;
      } else if (doc.status === 'Verified') {
        verified++;
      } else if (doc.status === 'Rejected') {
        rejected++;
      }

      if (doc.expiryDate) {
        const exp = new Date(doc.expiryDate);
        if (exp < now) {
          expired++;
        } else if (exp <= thirtyDaysAhead) {
          expiringSoon++;
        }
      }

      const cat = doc.category || 'Other HR';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    res.json(
      successResponse(
        {
          totalDocuments: allDocs.length,
          pendingVerification: pending,
          verifiedDocuments: verified,
          rejectedDocuments: rejected,
          expiredDocuments: expired,
          expiringSoon,
          totalEmployees,
          mandatoryRequirementsCount: requirements.length,
          categoryBreakdown: categoryMap,
        },
        'Document summary retrieved'
      )
    );
  }),

  // 3. Get single document by ID
  get: asyncHandler(async (req, res) => {
    const doc = await getOwnedDocument(req.params.id, req.user);
    res.json(successResponse(doc, 'Document retrieved'));
  }),

  // 4. Upload document
  upload: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createValidationError('A document file is required');
    }

    let owner = req.body.owner;
    if (!isHrOrAdmin(req.user)) {
      owner = req.user.userId;
    }

    if (!owner) {
      throw createValidationError('Assigned employee is required');
    }

    const targetUser = await User.findById(owner);
    if (!targetUser) {
      throw createNotFoundError('Selected employee not found');
    }

    const { name, category, documentType, documentNumber, issueDate, expiryDate, description } = req.body;

    if (!name || !name.trim()) {
      throw createValidationError('Document name is required');
    }

    const uploaderName = getFullName(req.user);
    const department = targetUser.department || targetUser.jobDetails?.department || '';

    // Generate unique Document ID
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    const generatedDocId = `DOC-${year}-${random}`;

    const doc = await Document.create({
      documentId: generatedDocId,
      owner,
      name: name.trim(),
      category: category || 'Other HR',
      documentType: documentType ? documentType.trim() : '',
      department,
      documentNumber: documentNumber ? documentNumber.trim() : '',
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description ? description.trim() : '',
      status: 'Pending Verification',
      version: 1,
      uploadedBy: req.user.userId,
      uploadedByName: uploaderName,
      history: [
        {
          action: 'UPLOAD',
          performedBy: req.user.userId,
          performedByName: uploaderName,
          timestamp: new Date(),
          details: `Uploaded initial version: ${name.trim()} (${category || 'Other HR'})`,
          version: 1,
        },
      ],
    });

    // Audit log
    await logDocumentAudit({
      req,
      targetEmployee: targetUser,
      action: 'UPLOAD',
      document: doc,
      sensitiveCategory: doc.category,
      reason: `Uploaded document "${doc.name}"`,
    });

    // Notify employee if uploaded by HR
    if (String(owner) !== String(req.user.userId)) {
      try {
        await Notification.create({
          recipient: owner,
          title: 'New Document Uploaded',
          message: `HR (${uploaderName}) uploaded a new document "${doc.name}" (${doc.category}) to your profile.`,
          type: 'Info',
        });
      } catch (e) {
        // Continue
      }
    }

    const populated = await Document.findById(doc._id)
      .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('uploadedBy', 'firstName lastName email department');

    res.status(201).json(createdResponse(populated, 'Document uploaded successfully and queued for verification'));
  }),

  // 5. Verify document
  verify: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can verify documents');
    }

    const doc = await Document.findById(req.params.id).populate('owner');
    if (!doc) {
      throw createNotFoundError('Document not found');
    }

    const reviewerName = getFullName(req.user);
    const { remarks } = req.body || {};

    doc.status = 'Verified';
    doc.verifiedBy = req.user.userId;
    doc.verifiedByName = reviewerName;
    doc.verifiedAt = new Date();
    doc.rejectionReason = '';

    doc.history.push({
      action: 'VERIFY',
      performedBy: req.user.userId,
      performedByName: reviewerName,
      timestamp: new Date(),
      details: remarks ? `Verified with remarks: ${remarks}` : 'Document verified successfully',
      version: doc.version,
    });

    await doc.save();

    // Audit log
    await logDocumentAudit({
      req,
      targetEmployee: doc.owner,
      action: 'VERIFY',
      document: doc,
      sensitiveCategory: doc.category,
      reason: remarks || 'Document verified',
    });

    // Notify employee
    try {
      await Notification.create({
        recipient: doc.owner._id || doc.owner,
        title: 'Document Verified ✅',
        message: `Your document "${doc.name}" has been verified by ${reviewerName}.`,
        type: 'Success',
      });
    } catch (e) {
      // Continue
    }

    const updated = await Document.findById(doc._id)
      .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('uploadedBy', 'firstName lastName email department')
      .populate('verifiedBy', 'firstName lastName email department');

    res.json(successResponse(updated, 'Document verified successfully'));
  }),

  // 6. Reject document
  reject: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can reject documents');
    }

    const { reason, remarks } = req.body;
    const rejectionText = (reason || remarks || '').trim();
    if (!rejectionText) {
      throw createValidationError('Rejection reason is required. Please explain why the document was rejected.');
    }

    const doc = await Document.findById(req.params.id).populate('owner');
    if (!doc) {
      throw createNotFoundError('Document not found');
    }

    const reviewerName = getFullName(req.user);

    doc.status = 'Rejected';
    doc.rejectedBy = req.user.userId;
    doc.rejectedByName = reviewerName;
    doc.rejectedAt = new Date();
    doc.rejectionReason = rejectionText;

    doc.history.push({
      action: 'REJECT',
      performedBy: req.user.userId,
      performedByName: reviewerName,
      timestamp: new Date(),
      details: `Rejected. Reason: ${rejectionText}`,
      rejectionReason: rejectionText,
      version: doc.version,
    });

    await doc.save();

    // Audit log
    await logDocumentAudit({
      req,
      targetEmployee: doc.owner,
      action: 'REJECT',
      document: doc,
      sensitiveCategory: doc.category,
      reason: rejectionText,
    });

    // Notify employee
    try {
      await Notification.create({
        recipient: doc.owner._id || doc.owner,
        title: 'Document Rejected ⚠️',
        message: `Your document "${doc.name}" was rejected by ${reviewerName}. Reason: "${rejectionText}". Please re-upload.`,
        type: 'Warning',
      });
    } catch (e) {
      // Continue
    }

    const updated = await Document.findById(doc._id)
      .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('uploadedBy', 'firstName lastName email department')
      .populate('rejectedBy', 'firstName lastName email department');

    res.json(successResponse(updated, 'Document rejected and reason recorded'));
  }),

  // 7. Replace / Re-upload document (creates new version)
  replace: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createValidationError('A replacement document file is required');
    }

    const oldDoc = await getOwnedDocument(req.params.id, req.user);
    const { name, category, documentType, documentNumber, issueDate, expiryDate, description } = req.body;

    const uploaderName = getFullName(req.user);
    const nextVersion = (oldDoc.version || 1) + 1;

    // Generate unique Document ID
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    const generatedDocId = `DOC-${year}-${random}`;

    // Create the replacement document in Pending Verification state
    const newDoc = await Document.create({
      documentId: generatedDocId,
      owner: oldDoc.owner._id || oldDoc.owner,
      name: (name && name.trim()) || oldDoc.name,
      category: category || oldDoc.category || 'Other HR',
      documentType: documentType !== undefined ? documentType.trim() : oldDoc.documentType,
      department: oldDoc.department,
      documentNumber: documentNumber !== undefined ? documentNumber.trim() : oldDoc.documentNumber,
      issueDate: issueDate ? new Date(issueDate) : oldDoc.issueDate,
      expiryDate: expiryDate ? new Date(expiryDate) : oldDoc.expiryDate,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description !== undefined ? description.trim() : oldDoc.description,
      status: 'Pending Verification',
      version: nextVersion,
      rootDocument: oldDoc.rootDocument || oldDoc._id,
      uploadedBy: req.user.userId,
      uploadedByName: uploaderName,
      replacedDocument: oldDoc._id,
      replacedAt: new Date(),
      history: [
        ...(oldDoc.history || []),
        {
          action: 'REPLACE',
          performedBy: req.user.userId,
          performedByName: uploaderName,
          timestamp: new Date(),
          details: `Replaced version ${oldDoc.version} with version ${nextVersion}`,
          version: nextVersion,
        },
      ],
    });

    // Archive previous version
    oldDoc.isArchived = true;
    oldDoc.history.push({
      action: 'ARCHIVE',
      performedBy: req.user.userId,
      performedByName: uploaderName,
      timestamp: new Date(),
      details: `Superseded by version ${nextVersion} (${newDoc.documentId})`,
      version: oldDoc.version,
    });
    await oldDoc.save();

    // Audit log
    await logDocumentAudit({
      req,
      targetEmployee: oldDoc.owner,
      action: 'REPLACE',
      document: newDoc,
      sensitiveCategory: newDoc.category,
      reason: `Replaced version ${oldDoc.version} with version ${nextVersion}`,
    });

    // Notify relevant party
    if (String(oldDoc.owner._id || oldDoc.owner) !== String(req.user.userId)) {
      try {
        await Notification.create({
          recipient: oldDoc.owner._id || oldDoc.owner,
          title: 'Document Replaced',
          message: `HR (${uploaderName}) uploaded version ${nextVersion} for "${oldDoc.name}". The document is now Pending verification.`,
          type: 'Info',
        });
      } catch (e) {
        // Continue
      }
    }

    const populated = await Document.findById(newDoc._id)
      .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('uploadedBy', 'firstName lastName email department');

    res.status(201).json(createdResponse(populated, 'Replacement document uploaded as new version'));
  }),

  // 8. Archive document
  archive: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can archive documents');
    }

    const doc = await getOwnedDocument(req.params.id, req.user);
    const uploaderName = getFullName(req.user);

    doc.isArchived = !doc.isArchived;
    doc.history.push({
      action: doc.isArchived ? 'ARCHIVE' : 'RESTORE',
      performedBy: req.user.userId,
      performedByName: uploaderName,
      timestamp: new Date(),
      details: doc.isArchived ? 'Document archived' : 'Document restored from archive',
      version: doc.version,
    });
    await doc.save();

    await logDocumentAudit({
      req,
      targetEmployee: doc.owner,
      action: doc.isArchived ? 'ARCHIVE' : 'RESTORE',
      document: doc,
      sensitiveCategory: doc.category,
    });

    res.json(successResponse(doc, `Document ${doc.isArchived ? 'archived' : 'restored'} successfully`));
  }),

  // 9. Download / View content stream
  download: asyncHandler(async (req, res) => {
    const doc = await getOwnedDocument(req.params.id, req.user);
    const filePath = path.join(uploadRoot, doc.storedName);

    try {
      await fs.access(filePath);
    } catch (e) {
      throw createNotFoundError('Stored file was not found on the server');
    }

    const isDownload = req.query.download === '1';

    // Audit viewing or downloading sensitive documents
    await logDocumentAudit({
      req,
      targetEmployee: doc.owner,
      action: isDownload ? 'DOWNLOAD' : 'VIEW',
      document: doc,
      sensitiveCategory: doc.category,
      reason: isDownload ? 'File downloaded' : 'File previewed in viewer',
    });

    const safeFilename = encodeURIComponent(doc.name.replace(/["\r\n]/g, ''));
    res.type(doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
    );
    res.sendFile(filePath);
  }),

  // 10. Remove document
  remove: asyncHandler(async (req, res) => {
    const doc = await getOwnedDocument(req.params.id, req.user);

    if (doc.status === 'Verified' && !isHrOrAdmin(req.user)) {
      throw createForbiddenError('Verified documents cannot be deleted by employees. Please contact HR.');
    }

    const filePath = path.join(uploadRoot, doc.storedName);
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });

    await logDocumentAudit({
      req,
      targetEmployee: doc.owner,
      action: 'DELETE',
      document: doc,
      sensitiveCategory: doc.category,
      reason: 'Document removed',
    });

    await doc.deleteOne();
    res.json(successResponse({ id: req.params.id }, 'Document deleted successfully'));
  }),

  // 11. Document Requirements: List, Create, Delete
  getRequirements: asyncHandler(async (req, res) => {
    await ensureDefaultRequirements(req.user.userId, getFullName(req.user));
    const requirements = await DocumentRequirement.find().sort('category name').lean();
    res.json(successResponse(requirements, 'Document requirements retrieved'));
  }),

  createRequirement: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can configure document requirements');
    }

    const { name, category, documentType, isMandatory = true, applicableDepartment = 'All', description } = req.body;
    if (!name || !name.trim()) {
      throw createValidationError('Requirement name is required');
    }

    const reqDoc = await DocumentRequirement.create({
      name: name.trim(),
      category: category || 'Identity Proof',
      documentType: documentType ? documentType.trim() : name.trim(),
      isMandatory: Boolean(isMandatory),
      applicableDepartment: applicableDepartment || 'All',
      description: description ? description.trim() : '',
      createdBy: req.user.userId,
      createdByName: getFullName(req.user),
    });

    res.status(201).json(createdResponse(reqDoc, 'Document requirement created successfully'));
  }),

  deleteRequirement: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can delete document requirements');
    }

    const requirement = await DocumentRequirement.findById(req.params.id);
    if (!requirement) {
      throw createNotFoundError('Requirement not found');
    }

    await requirement.deleteOne();
    res.json(successResponse({ id: req.params.id }, 'Document requirement removed'));
  }),

  // 12. Missing Documents Analysis
  getMissingDocuments: asyncHandler(async (req, res) => {
    await ensureDefaultRequirements(req.user.userId, getFullName(req.user));

    const { department, owner } = req.query;

    const userFilter = {
      role: 'employee',
      isActive: true,
      employmentStatus: { $nin: ['Exited', 'Terminated'] },
    };

    if (!isHrOrAdmin(req.user)) {
      userFilter._id = req.user.userId;
    } else if (owner && owner !== 'All') {
      userFilter._id = owner;
    }

    if (department && department !== 'All') {
      userFilter.$or = [{ department }, { 'jobDetails.department': department }];
    }

    const [employees, requirements, activeDocs] = await Promise.all([
      User.find(userFilter).select('firstName lastName email department designation jobDetails personalInfo').lean(),
      DocumentRequirement.find({ isMandatory: true }).lean(),
      Document.find({ isArchived: { $ne: true } }).select('owner name category documentType status').lean(),
    ]);

    const result = employees.map((emp) => {
      const empDocs = activeDocs.filter((d) => String(d.owner) === String(emp._id));

      const missing = [];
      const fulfilled = [];

      requirements.forEach((reqItem) => {
        // Match by documentType or name or category
        const matched = empDocs.find(
          (d) =>
            (d.documentType && d.documentType.toLowerCase() === reqItem.name.toLowerCase()) ||
            d.name.toLowerCase().includes(reqItem.name.toLowerCase()) ||
            (reqItem.documentType && d.documentType && d.documentType.toLowerCase() === reqItem.documentType.toLowerCase())
        );

        if (matched) {
          fulfilled.push({
            requirement: reqItem.name,
            category: reqItem.category,
            document: matched,
            status: matched.status,
          });
        } else {
          missing.push({
            requirementId: reqItem._id,
            name: reqItem.name,
            category: reqItem.category,
            description: reqItem.description,
          });
        }
      });

      const totalReq = requirements.length;
      const compliance = totalReq > 0 ? Math.round((fulfilled.length / totalReq) * 100) : 100;

      return {
        employee: {
          _id: emp._id,
          name: getFullName(emp),
          email: emp.email,
          employeeId: emp.jobDetails?.employeeId || '—',
          department: emp.department || emp.jobDetails?.department || 'General',
          designation: emp.designation || emp.jobDetails?.designation || 'Staff',
        },
        missingCount: missing.length,
        fulfilledCount: fulfilled.length,
        totalRequired: totalReq,
        compliancePercentage: compliance,
        missing,
        fulfilled,
      };
    });

    res.json(successResponse(result, 'Missing documents analysis retrieved'));
  }),

  // 13. Audit & History Stream
  getHistory: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can view global document audit history');
    }

    const { limit = 50 } = req.query;
    const audits = await AccessAudit.find({ moduleKey: 'documents' })
      .sort('-date -createdAt')
      .limit(Number(limit))
      .lean();

    res.json(successResponse(audits, 'Document history retrieved'));
  }),

  // 14. Export to CSV for compliance reporting
  exportReport: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can export document reports');
    }

    const docs = await Document.find({ isArchived: { $ne: true } })
      .populate('owner', 'firstName lastName email department jobDetails')
      .sort('-createdAt')
      .lean();

    let csv = 'Document ID,Document Name,Category,Document Type,Status,Employee Name,Employee ID,Department,Issue Date,Expiry Date,Upload Date,Uploaded By,Verified By\n';

    docs.forEach((d) => {
      const empName = d.owner ? getFullName(d.owner) : '';
      const empCode = d.owner?.jobDetails?.employeeId || '';
      const dept = d.owner?.department || d.owner?.jobDetails?.department || d.department || '';
      const issue = d.issueDate ? new Date(d.issueDate).toISOString().split('T')[0] : '';
      const expiry = d.expiryDate ? new Date(d.expiryDate).toISOString().split('T')[0] : '';
      const upload = d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : '';

      const row = [
        `"${d.documentId || ''}"`,
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${d.category || ''}"`,
        `"${d.documentType || ''}"`,
        `"${d.status || ''}"`,
        `"${empName.replace(/"/g, '""')}"`,
        `"${empCode}"`,
        `"${dept}"`,
        `"${issue}"`,
        `"${expiry}"`,
        `"${upload}"`,
        `"${d.uploadedByName || ''}"`,
        `"${d.verifiedByName || ''}"`,
      ].join(',');

      csv += row + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="document_compliance_report.csv"');
    res.send(csv);
  }),
};

export default DocumentController;
