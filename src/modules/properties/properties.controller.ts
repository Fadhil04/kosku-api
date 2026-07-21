import { Request, Response, NextFunction } from 'express';
import { propertiesService } from './properties.service';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema,
} from './properties.schema';
import { apiResponse } from '../../utils/apiResponse';

export class PropertiesController {

  async createProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createPropertySchema.parse(req.body);
      const ownerId = req.context!.userId;
      const data = await propertiesService.createProperty(ownerId, input);
      return apiResponse.created(res, data, 'Properti berhasil ditambahkan');
    } catch (error) {
      next(error);
    }
  }

  async getProperties(req: Request, res: Response, next: NextFunction) {
    try {
      const query = propertyQuerySchema.parse(req.query);
      const ownerId = req.context!.userId;
      const result = await propertiesService.getProperties(ownerId, query);
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getPropertyById(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const data = await propertiesService.getPropertyById(propertyId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const input = updatePropertySchema.parse(req.body);
      const data = await propertiesService.updateProperty(propertyId, ownerId, input);
      return apiResponse.success(res, data, 'Properti berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async deleteProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      const ownerId = req.context!.userId;
      const data = await propertiesService.deleteProperty(propertyId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const propertiesController = new PropertiesController();