import { Router } from 'express';
import { contractsController } from './contracts.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate, authorize('owner'));

router.post('/', contractsController.createContract.bind(contractsController));
router.get('/', contractsController.getContracts.bind(contractsController));
router.get('/expiring-soon', contractsController.getExpiringContracts.bind(contractsController));
router.get('/:contractId', contractsController.getContractById.bind(contractsController));
router.patch('/:contractId/terminate', contractsController.terminateContract.bind(contractsController));
router.patch('/:contractId/renew', contractsController.renewContract.bind(contractsController));

export { router as contractsRouter };