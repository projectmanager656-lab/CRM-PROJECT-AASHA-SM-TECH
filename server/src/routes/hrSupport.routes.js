import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import HRSupportController from '../controllers/HRSupportController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const uploadDir = path.resolve('uploads/documents');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `hrsupport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

// All HR Support endpoints require an authenticated user
router.use(authenticateToken);

// 1. Master Data & Staff Listing
router.get('/categories', HRSupportController.getCategories);
router.get('/hr-staff', HRSupportController.getHrStaff);

// 2. Summary & Real Database KPIs
router.get('/summary', HRSupportController.getSummary);

// 3. Reports & Analytics (HR / Admin only)
router.get('/reports', authorizeHrOrAdmin, HRSupportController.getReports);

// 4. Main Collection Routes (List & Create)
router
  .route('/')
  .get(HRSupportController.list)
  .post(HRSupportController.create);

// 5. Single Case Operations
router.get('/:id', HRSupportController.getById);

// HR Management Actions
router.patch('/:id/assign', authorizeHrOrAdmin, HRSupportController.assign);
router.patch('/:id/status', authorizeHrOrAdmin, HRSupportController.updateStatus);
router.patch('/:id/priority', authorizeHrOrAdmin, HRSupportController.updatePriority);
router.patch('/:id/due-date', authorizeHrOrAdmin, HRSupportController.updateDueDate);
router.post('/:id/resolve', authorizeHrOrAdmin, HRSupportController.resolve);
router.post('/:id/close', authorizeHrOrAdmin, HRSupportController.close);
router.post('/:id/internal-note', authorizeHrOrAdmin, HRSupportController.addInternalNote);

// Collaborative & Lifecycle Actions
router.post('/:id/respond', HRSupportController.addResponse);
router.post('/:id/reopen', HRSupportController.reopen);
router.post('/:id/reminder', HRSupportController.manageReminder);
router.patch('/:id/reminder', HRSupportController.manageReminder);
router.post('/:id/attachments', upload.single('file'), HRSupportController.uploadAttachment);

export default router;
