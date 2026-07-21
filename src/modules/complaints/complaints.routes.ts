import { Router } from 'express';
import { complaintsController } from './complaints.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

router.post('/', authorize('tenant'), complaintsController.createComplaint.bind(complaintsController));
router.get('/', complaintsController.getComplaints.bind(complaintsController));
router.get('/summary', authorize('owner'), complaintsController.getSummary.bind(complaintsController));
router.get('/:complaintId', complaintsController.getComplaintById.bind(complaintsController));
router.patch('/:complaintId/status', authorize('owner'), complaintsController.updateStatus.bind(complaintsController));
router.post('/:complaintId/responses', complaintsController.addResponse.bind(complaintsController));

export { router as complaintsRouter };