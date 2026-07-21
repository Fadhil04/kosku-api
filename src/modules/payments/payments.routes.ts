import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

// Router untuk nested di /bills/:billId/payments
const billPaymentsRouter = Router({ mergeParams: true });
billPaymentsRouter.use(authenticate, authorize('owner'));
billPaymentsRouter.post('/', paymentsController.createPayment.bind(paymentsController));
billPaymentsRouter.get('/', paymentsController.getPaymentsByBillId.bind(paymentsController));

// Router standalone untuk /payments/:paymentId
const paymentsRouter = Router();
paymentsRouter.use(authenticate, authorize('owner'));
paymentsRouter.get('/:paymentId', paymentsController.getPaymentById.bind(paymentsController));

export { billPaymentsRouter, paymentsRouter };