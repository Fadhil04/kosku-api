import { Request, Response, NextFunction } from 'express';
import { billsService } from './bills.service';
import {
  billQuerySchema,
  overdueBillQuerySchema,
  discountBillSchema,
  waiveBillSchema,
} from './bills.schema';
import { apiResponse } from '../../utils/apiResponse';

export class BillsController {

  async getBills(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role } = req.context!;
      const query = billQuerySchema.parse(req.query);
      const result = await billsService.getBills(
        userId,
        role as 'owner' | 'tenant',
        query,
      );
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getBillById(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId } = req.params;
      const { userId, role } = req.context!;
      const data = await billsService.getBillById(
        billId,
        userId,
        role as 'owner' | 'tenant',
      );
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getOverdueBills(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const query = overdueBillQuerySchema.parse(req.query);
      const data = await billsService.getOverdueBills(ownerId, query);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId } = req.params;
      const ownerId = req.context!.userId;
      const input = discountBillSchema.parse(req.body);
      const data = await billsService.applyDiscount(billId, ownerId, input);
      return apiResponse.success(res, data, 'Diskon berhasil diterapkan');
    } catch (error) {
      next(error);
    }
  }

  async waiveBill(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId } = req.params;
      const ownerId = req.context!.userId;
      const input = waiveBillSchema.parse(req.body);
      const data = await billsService.waiveBill(billId, ownerId, input);
      return apiResponse.success(res, data, 'Tagihan berhasil dihapuskan');
    } catch (error) {
      next(error);
    }
  }
}

export const billsController = new BillsController();