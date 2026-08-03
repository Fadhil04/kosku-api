import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { schedulerQueue } from '../../jobs/queues/scheduler.queue';
import { prisma } from '../../config/database';
import { apiResponse } from '../../utils/apiResponse';

const router = Router();

router.use(authenticate, authorize('owner'));

// ── Backfill: Set createdByOwnerId untuk tenant lama yang belum punya ────────
// Dipanggil sekali saja setelah migrasi schema
router.post('/backfill/tenant-owner', async (req, res, next) => {
  try {
    const ownerId = req.context!.userId;

    // Cari semua tenant yang pernah berkontrak dengan owner ini
    // tapi belum punya createdByOwnerId
    const contracts = await prisma.contract.findMany({
      where: { ownerId },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    const tenantIds = contracts.map((c) => c.tenantId);

    if (tenantIds.length === 0) {
      return apiResponse.success(res, { updated: 0 }, 'Tidak ada tenant yang perlu diupdate');
    }

    const result = await prisma.tenant.updateMany({
      where: {
        id: { in: tenantIds },
        createdByOwnerId: null, // hanya yang belum diset
      },
      data: { createdByOwnerId: ownerId },
    });

    return apiResponse.success(
      res,
      { updated: result.count },
      `Berhasil update ${result.count} tenant`,
    );
  } catch (error) {
    next(error);
  }
});

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