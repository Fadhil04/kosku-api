import { Request, Response, NextFunction } from 'express';
import { complaintsService } from './complaints.service';
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  addResponseSchema,
  complaintQuerySchema,
} from './complaints.schema';
import { apiResponse } from '../../utils/apiResponse';

export class ComplaintsController {

  async createComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.context!.userId;
      const input = createComplaintSchema.parse(req.body);
      const data = await complaintsService.createComplaint(tenantId, input);
      return apiResponse.created(res, data, 'Komplain berhasil diajukan');
    } catch (error) {
      next(error);
    }
  }

  async getComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role } = req.context!;
      const query = complaintQuerySchema.parse(req.query);
      const result = await complaintsService.getComplaints(
        userId,
        role as 'owner' | 'tenant',
        query,
      );
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getComplaintById(req: Request, res: Response, next: NextFunction) {
    try {
      const { complaintId } = req.params;
      const { userId, role } = req.context!;
      const data = await complaintsService.getComplaintById(
        complaintId,
        userId,
        role as 'owner' | 'tenant',
      );
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { complaintId } = req.params;
      const ownerId = req.context!.userId;
      const input = updateComplaintStatusSchema.parse(req.body);
      const data = await complaintsService.updateStatus(complaintId, ownerId, input);
      return apiResponse.success(res, data, 'Status komplain berhasil diperbarui');
    } catch (error) {
      next(error);
    }
  }

  async addResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const { complaintId } = req.params;
      const { userId, role } = req.context!;
      const input = addResponseSchema.parse(req.body);
      const data = await complaintsService.addResponse(
        complaintId,
        userId,
        role as 'owner' | 'tenant',
        input,
      );
      return apiResponse.created(res, data, 'Balasan berhasil ditambahkan');
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const propertyId = req.query.property_id as string | undefined;
      const data = await complaintsService.getComplaintsSummary(ownerId, propertyId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const complaintsController = new ComplaintsController();