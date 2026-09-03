import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
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

const getOwnedDocument = async (id, user) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createValidationError('Invalid document ID');
  }

  const doc = await Document.findById(id)
    .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
    .populate('uploadedBy', 'firstName lastName email department')
    .populate('verifiedBy', 'firstName lastName email department')
    .populate('rejectedBy', 'firstName lastName email department');

  if (!doc) {
    throw createNotFoundError('Document not found');
  }

  if (user.role === 'employee' && user.department !== 'HR' && String(doc.owner?._id || doc.owner) !== String(user.userId)) {
    throw createForbiddenError('Access denied: You can only access your own documents');
  }

  return doc;
};

export const DocumentController = {
  // 1. List documents with dynamic search & filtering
  list: asyncHandler(async (req, res) => {
    const { owner, department, category, status, expiryStatus, search, page = 1, limit = 50, sort = '-createdAt' } = req.query;

    const filter = { isArchived: { $ne: true } };

    // Employee isolation for non-HR
    if (!isHrOrAdmin(req.user)) {
      filter.owner = req.user.userId;
    } else if (owner && owner !== 'All') {
      filter.owner = owner;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (status && status !== 'All') {
      filter.status = status;
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

    // Department filtering & Search across users
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
        { name: { $regex: s, $options: 'i' } },
        { documentNumber: { $regex: s, $options: 'i' } },
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
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
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

    const [allDocs, totalEmployees] = await Promise.all([
      Document.find(filter).select('status category expiryDate owner').lean(),
      User.countDocuments({ role: 'employee', isActive: true, employmentStatus: { $nin: ['Exited', 'Terminated'] } }),
    ]);

    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let expired = 0;
    let expiringSoon = 0;
    const categoryMap = {};

    allDocs.forEach((doc) => {
      if (doc.status === 'Pending') pending++;
      else if (doc.status === 'Verified') verified++;
      else if (doc.status === 'Rejected') rejected++;

      if (doc.expiryDate) {
        const exp = new Date(doc.expiryDate);
        if (exp < now) {
          expired++;
        } else if (exp <= thirtyDaysAhead) {
          expiringSoon++;
        }
      }

      const cat = doc.category || 'Other';
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

    const { name, category, documentNumber, issueDate, expiryDate, description } = req.body;

    if (!name || !name.trim()) {
      throw createValidationError('Document name is required');
    }

    const uploaderName = getFullName(req.user);

    const doc = await Document.create({
      owner,
      name: name.trim(),
      category: category || 'Other',
      documentNumber: documentNumber ? documentNumber.trim() : '',
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description ? description.trim() : '',
      status: 'Pending',
      uploadedBy: req.user.userId,
      uploadedByName: uploaderName,
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
        // Log and continue
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

    const doc = await Document.findById(req.params.id);
    if (!doc) {
      throw createNotFoundError('Document not found');
    }

    if (doc.status === 'Verified') {
      return res.json(successResponse(doc, 'Document is already verified'));
    }

    const reviewerName = getFullName(req.user);

    doc.status = 'Verified';
    doc.verifiedBy = req.user.userId;
    doc.verifiedByName = reviewerName;
    doc.verifiedAt = new Date();
    doc.rejectionReason = ''; // Clear any previous rejection reason
    await doc.save();

    // Notify employee
    try {
      await Notification.create({
        recipient: doc.owner,
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

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      throw createValidationError('Rejection reason is required');
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) {
      throw createNotFoundError('Document not found');
    }

    if (doc.status === 'Verified') {
      throw createValidationError('Verified documents cannot be rejected directly. Please replace or re-upload the document.');
    }

    const reviewerName = getFullName(req.user);

    doc.status = 'Rejected';
    doc.rejectedBy = req.user.userId;
    doc.rejectedByName = reviewerName;
    doc.rejectedAt = new Date();
    doc.rejectionReason = reason.trim();
    await doc.save();

    // Notify employee
    try {
      await Notification.create({
        recipient: doc.owner,
        title: 'Document Rejected ⚠️',
        message: `Your document "${doc.name}" was rejected by ${reviewerName}. Reason: "${doc.rejectionReason}". Please re-upload.`,
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

  // 7. Replace / Re-upload document
  replace: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createValidationError('A replacement document file is required');
    }

    const oldDoc = await getOwnedDocument(req.params.id, req.user);
    const { name, category, documentNumber, issueDate, expiryDate, description } = req.body;

    const uploaderName = getFullName(req.user);

    // Create the replacement document in Pending state
    const newDoc = await Document.create({
      owner: oldDoc.owner._id || oldDoc.owner,
      name: (name && name.trim()) || oldDoc.name,
      category: category || oldDoc.category || 'Other',
      documentNumber: documentNumber !== undefined ? documentNumber.trim() : oldDoc.documentNumber,
      issueDate: issueDate ? new Date(issueDate) : oldDoc.issueDate,
      expiryDate: expiryDate ? new Date(expiryDate) : oldDoc.expiryDate,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description !== undefined ? description.trim() : oldDoc.description,
      status: 'Pending', // Must go back to Pending for verification
      uploadedBy: req.user.userId,
      uploadedByName: uploaderName,
      replacedDocument: oldDoc._id,
      replacedAt: new Date(),
    });

    // Mark old document as archived
    oldDoc.isArchived = true;
    await oldDoc.save();

    // Notify relevant party
    if (String(oldDoc.owner._id || oldDoc.owner) !== String(req.user.userId)) {
      try {
        await Notification.create({
          recipient: oldDoc.owner._id || oldDoc.owner,
          title: 'Document Replaced',
          message: `HR (${uploaderName}) uploaded a replacement for "${oldDoc.name}". The document is now Pending verification.`,
          type: 'Info',
        });
      } catch (e) {
        // Continue
      }
    }

    const populated = await Document.findById(newDoc._id)
      .populate('owner', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('uploadedBy', 'firstName lastName email department');

    res.status(201).json(createdResponse(populated, 'Replacement document uploaded and queued for verification'));
  }),

  // 8. Download / View content stream
  download: asyncHandler(async (req, res) => {
    const doc = await getOwnedDocument(req.params.id, req.user);
    const filePath = path.join(uploadRoot, doc.storedName);

    try {
      await fs.access(filePath);
    } catch (e) {
      throw createNotFoundError('Stored file was not found on the server');
    }

    const safeFilename = encodeURIComponent(doc.name.replace(/["\r\n]/g, ''));
    res.type(doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
    );
    res.sendFile(filePath);
  }),

  // 9. Remove document
  remove: asyncHandler(async (req, res) => {
    const doc = await getOwnedDocument(req.params.id, req.user);

    if (doc.status === 'Verified' && !isHrOrAdmin(req.user)) {
      throw createForbiddenError('Verified documents cannot be deleted by employees. Please contact HR.');
    }

    const filePath = path.join(uploadRoot, doc.storedName);
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });

    await doc.deleteOne();
    res.json(successResponse({ id: req.params.id }, 'Document deleted successfully'));
  }),
};

export default DocumentController;
