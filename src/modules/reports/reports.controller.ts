import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service';
import {
  revenueReportSchema,
  occupancyReportSchema,
  paymentBehaviorSchema,
  complaintsSummarySchema,
  expiringContractsReportSchema,
} from './reports.schema';
import { apiResponse } from '../../utils/apiResponse';

export class ReportsController {

  async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = revenueReportSchema.parse(req.query);
      const data = await reportsService.getRevenueReport(ownerId, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOccupancyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = occupancyReportSchema.parse(req.query);
      const data = await reportsService.getOccupancyReport(ownerId, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentBehaviorReport(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = paymentBehaviorSchema.parse(req.query);
      const data = await reportsService.getPaymentBehaviorReport(ownerId, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getComplaintsSummaryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = complaintsSummarySchema.parse(req.query);
      const data = await reportsService.getComplaintsSummaryReport(ownerId, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getExpiringContractsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = expiringContractsReportSchema.parse(req.query);
      const data = await reportsService.getExpiringContractsReport(ownerId, input);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const data = await reportsService.getDashboardSummary(ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();