import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { schedulerQueue } from '../../jobs/queues/scheduler.queue';
import { apiResponse } from '../../utils/apiResponse';

const router = Router();

router.use(authenticate, authorize('owner'));

// Trigger manual untuk testing — JANGAN expose ini di production
// tanpa proteksi tambahan atau hapus sama sekali setelah testing
router.post('/trigger/bill-reminders', async (_req, res, next) => {
  try {
    const job = await schedulerQueue.add('check-bill-reminders', {});
    return apiResponse.success(res, { jobId: job.id }, 'Job reminder di-trigger manual');
  } catch (error) {
    next(error);
  }
});

router.post('/trigger/monthly-bills', async (_req, res, next) => {
  try {
    const job = await schedulerQueue.add('generate-monthly-bills', {});
    return apiResponse.success(res, { jobId: job.id }, 'Job generate bills di-trigger manual');
  } catch (error) {
    next(error);
  }
});

router.post('/trigger/expiring-contracts', async (_req, res, next) => {
  try {
    const job = await schedulerQueue.add('check-expiring-contracts', {});
    return apiResponse.success(res, { jobId: job.id }, 'Job expiring contracts di-trigger manual');
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };