import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);

router.post('/check-conflict', requirePermission('communications', 'calendar', 'view'), CalendarController.checkConflict);

router
  .route('/')
  .get(requirePermission('communications', 'calendar', 'view'), CalendarController.list)
  .post(requirePermission('communications', 'calendar', 'create'), CalendarController.create);

router
  .route('/:id')
  .get(requirePermission('communications', 'calendar', 'view'), CalendarController.get)
  .put(requirePermission('communications', 'calendar', 'edit'), CalendarController.update)
  .patch(requirePermission('communications', 'calendar', 'edit'), CalendarController.update)
  .delete(requirePermission('communications', 'calendar', 'delete'), CalendarController.remove);

export default router;
