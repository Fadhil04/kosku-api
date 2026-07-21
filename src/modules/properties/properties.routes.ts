import { Router } from 'express';
import { propertiesController } from './properties.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

// Semua route properties hanya untuk owner
router.use(authenticate, authorize('owner'));

router.post('/', propertiesController.createProperty.bind(propertiesController));
router.get('/', propertiesController.getProperties.bind(propertiesController));
router.get('/:propertyId', propertiesController.getPropertyById.bind(propertiesController));
router.put('/:propertyId', propertiesController.updateProperty.bind(propertiesController));
router.delete('/:propertyId', propertiesController.deleteProperty.bind(propertiesController));

export { router as propertiesRouter };