import { Request, Response, NextFunction } from 'express';
import { tenantsService } from './tenants.service';
import {
  createTenantSchema,
  updateTenantSchema,
  tenantQuerySchema,
} from './tenants.schema';
import { apiResponse } from '../../utils/apiResponse';

export class TenantsController {

  async createTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = createTenantSchema.parse(req.body);
      const data = await tenantsService.createTenant(ownerId, input);
      return apiResponse.created(
        res,
        data,
        'Penghuni berhasil didaftarkan, kredensial telah dikirim via email',
      );
    } catch (error) {
      next(error);
    }
  }

  async getTenants(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const query = tenantQuerySchema.parse(req.query);
      const result = await tenantsService.getTenants(ownerId, query);
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getTenantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const ownerId = req.context!.userId;
      const data = await tenantsService.getTenantById(tenantId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const ownerId = req.context!.userId;
      const input = updateTenantSchema.parse(req.body);
      const data = await tenantsService.updateTenant(tenantId, ownerId, input);
      return apiResponse.success(res, data, 'Data penghuni berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }
}

export const tenantsController = new TenantsController();