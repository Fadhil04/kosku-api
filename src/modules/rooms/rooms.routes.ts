import { Router } from 'express';
import { roomsController } from './rooms.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router({ mergeParams: true }); // mergeParams untuk akses propertyId dari parent router

router.use(authenticate, authorize('owner'));

router.post('/', roomsController.createRoom.bind(roomsController));
router.get('/', roomsController.getRooms.bind(roomsController));
router.get('/available', roomsController.getAvailableRooms.bind(roomsController));
router.get('/:roomId', roomsController.getRoomById.bind(roomsController));
router.put('/:roomId', roomsController.updateRoom.bind(roomsController));
router.patch('/:roomId/status', roomsController.updateRoomStatus.bind(roomsController));
router.delete('/:roomId', roomsController.deleteRoom.bind(roomsController));

export { router as roomsRouter };