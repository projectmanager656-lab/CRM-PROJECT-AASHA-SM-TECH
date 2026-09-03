import { Router } from 'express';
import { AssetController } from '../controllers/AssetController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

// 1. Asset Summary KPI
router.get('/summary', AssetController.summary);

// 2. Asset List & Create
router
  .route('/')
  .get(AssetController.list)
  .post(authorizeHrOrAdmin, AssetController.create);

// 3. Asset Details, Update & Delete
router
  .route('/:id')
  .get(AssetController.get)
  .put(authorizeHrOrAdmin, AssetController.update)
  .delete(authorizeHrOrAdmin, AssetController.remove);

// 4. Asset Lifecycle Operations
router.patch('/:id/assign', authorizeHrOrAdmin, AssetController.assign);
router.patch('/:id/return', authorizeHrOrAdmin, AssetController.returnToStock);
router.patch('/:id/maintenance', authorizeHrOrAdmin, AssetController.maintenance);
router.patch('/:id/transfer', authorizeHrOrAdmin, AssetController.transfer);
router.patch('/:id/lost-damaged', authorizeHrOrAdmin, AssetController.lostOrDamaged);
router.patch('/:id/retire-dispose', authorizeHrOrAdmin, AssetController.retireOrDispose);

export default router;
