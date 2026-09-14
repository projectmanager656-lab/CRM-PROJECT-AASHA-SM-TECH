import { Router } from 'express';
import ExpenseController from '../controllers/ExpenseController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const expenseRouter = Router();
expenseRouter.use(authenticateToken);

expenseRouter.patch('/:id/approve', ExpenseController.approve);
expenseRouter.patch('/:id/reject', ExpenseController.reject);
expenseRouter.patch('/:id/pay', ExpenseController.pay);

expenseRouter
  .route('/')
  .get(ExpenseController.list)
  .post(ExpenseController.create);

expenseRouter
  .route('/:id')
  .get(ExpenseController.get)
  .put(ExpenseController.update)
  .patch(ExpenseController.update)
  .delete(ExpenseController.remove);

export default expenseRouter;
