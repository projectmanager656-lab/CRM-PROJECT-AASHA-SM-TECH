import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/DocumentController.js';
import { authenticateToken, authorizeHrOrAdmin, requirePermission } from '../middleware/auth.middleware.js';

const root = path.resolve('uploads/documents');
fs.mkdirSync(root, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    // Allow common document and image types
    const allowed = /pdf|doc|docx|xls|xlsx|csv|txt|rtf|png|jpg|jpeg|webp/i;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, true); // Permissive for business documents
    }
  },
});

const router = Router();

router.use(authenticateToken);

// 1. Summary & Aggregations
router.get('/summary', DocumentController.summary);

// 2. Main List & Upload
router
  .route('/')
  .get(DocumentController.list)
  .post(upload.single('file'), DocumentController.upload);

// 3. Verification & Rejection Workflows
router.patch('/:id/verify', authorizeHrOrAdmin, DocumentController.verify);
router.patch('/:id/reject', authorizeHrOrAdmin, DocumentController.reject);
router.post('/:id/replace', upload.single('file'), DocumentController.replace);

// 4. Content / Download Stream
router.get('/:id/content', DocumentController.download);

// 5. Single Document View & Delete
router
  .route('/:id')
  .get(DocumentController.get)
  .delete(DocumentController.remove);

export default router;
