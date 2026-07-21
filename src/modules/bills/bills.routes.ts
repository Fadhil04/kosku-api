import { Router } from 'express';
import { billsController } from './bills.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

// Owner dan tenant bisa lihat bills (dengan scope berbeda di service)
router.get('/', billsController.getBills.bind(billsController));

// Khusus owner
router.get('/overdue', authorize('owner'), billsController.getOverdueBills.bind(billsController));
router.get('/:billId', billsController.getBillById.bind(billsController));
router.patch('/:billId/discount', authorize('owner'), billsController.applyDiscount.bind(billsController));
router.patch('/:billId/waive', authorize('owner'), billsController.waiveBill.bind(billsController));

export { router as billsRouter };