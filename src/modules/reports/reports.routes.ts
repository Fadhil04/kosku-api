import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { reportsRateLimiter } from '../../middleware/rateLimiter';
const router = Router();

router.use(authenticate, authorize('owner'));

router.get('/dashboard', reportsController.getDashboard.bind(reportsController));
router.get('/revenue', reportsController.getRevenueReport.bind(reportsController));
router.get('/occupancy', reportsController.getOccupancyReport.bind(reportsController));
router.get('/payment-behavior', reportsController.getPaymentBehaviorReport.bind(reportsController));
router.get('/complaints', reportsController.getComplaintsSummaryReport.bind(reportsController));
router.get('/expiring-contracts', reportsController.getExpiringContractsReport.bind(reportsController));
router.use(authenticate, authorize('owner'), reportsRateLimiter);
export { router as reportsRouter };