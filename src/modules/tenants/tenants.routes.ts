import { Router } from 'express';
import { tenantsController } from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate, authorize('owner'));

router.post('/', tenantsController.createTenant.bind(tenantsController));
router.get('/', tenantsController.getTenants.bind(tenantsController));
router.get('/:tenantId', tenantsController.getTenantById.bind(tenantsController));
router.put('/:tenantId', tenantsController.updateTenant.bind(tenantsController));

export { router as tenantsRouter };