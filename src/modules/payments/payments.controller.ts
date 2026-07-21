import { Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service';
import { createPaymentSchema } from './payments.schema';
import { apiResponse } from '../../utils/apiResponse';

export class PaymentsController {

  async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId } = req.params;
      const ownerId = req.context!.userId;
      const input = createPaymentSchema.parse(req.body);
      const result = await paymentsService.createPayment(billId, ownerId, input);

      const message = result.is_duplicate_request
        ? 'Pembayaran ini sudah tercatat sebelumnya'
        : 'Pembayaran berhasil dicatat';

      return apiResponse.created(res, result, message);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentsByBillId(req: Request, res: Response, next: NextFunction) {
    try {
      const { billId } = req.params;
      const ownerId = req.context!.userId;
      const data = await paymentsService.getPaymentsByBillId(billId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const ownerId = req.context!.userId;
      const data = await paymentsService.getPaymentById(paymentId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentsController = new PaymentsController();