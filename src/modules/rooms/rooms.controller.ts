import { Request, Response, NextFunction } from 'express';
import { roomsService } from './rooms.service';
import {
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  roomQuerySchema,
} from './rooms.schema';
import { apiResponse } from '../../utils/apiResponse';

export class RoomsController {

  async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const input = createRoomSchema.parse(req.body);
      const data = await roomsService.createRoom(propertyId, ownerId, input);
      return apiResponse.created(res, data, 'Kamar berhasil ditambahkan');
    } catch (error) {
      next(error);
    }
  }

  async getRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const query = roomQuerySchema.parse(req.query);
      const result = await roomsService.getRooms(propertyId, ownerId, query);
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const data = await roomsService.getAvailableRooms(propertyId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getRoomById(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId, roomId } = req.params;
      const ownerId = req.context!.userId;
      const data = await roomsService.getRoomById(propertyId, roomId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId, roomId } = req.params;
      const ownerId = req.context!.userId;
      const input = updateRoomSchema.parse(req.body);
      const data = await roomsService.updateRoom(propertyId, roomId, ownerId, input);
      return apiResponse.success(res, data, 'Kamar berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async updateRoomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId, roomId } = req.params;
      const ownerId = req.context!.userId;
      const input = updateRoomStatusSchema.parse(req.body);
      const data = await roomsService.updateRoomStatus(
        propertyId,
        roomId,
        ownerId,
        input,
      );
      return apiResponse.success(res, data, 'Status kamar berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async deleteRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId, roomId } = req.params;
      const ownerId = req.context!.userId;
      const data = await roomsService.deleteRoom(propertyId, roomId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const roomsController = new RoomsController();