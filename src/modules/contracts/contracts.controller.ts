import { Request, Response, NextFunction } from 'express';
import { contractsService } from './contracts.service';
import {
  createContractSchema,
  terminateContractSchema,
  renewContractSchema,
  contractQuerySchema,
  expiringContractQuerySchema,
} from './contracts.schema';
import { apiResponse } from '../../utils/apiResponse';

export class ContractsController {

  async createContract(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const input = createContractSchema.parse(req.body);
      const data = await contractsService.createContract(ownerId, input);
      return apiResponse.created(
        res,
        data,
        `Kontrak berhasil dibuat dengan ${data.bills_generated} tagihan otomatis`,
      );
    } catch (error) {
      next(error);
    }
  }

  async getContracts(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const query = contractQuerySchema.parse(req.query);
      const result = await contractsService.getContracts(ownerId, query);
      return apiResponse.success(res, result.data, 'Berhasil', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getContractById(req: Request, res: Response, next: NextFunction) {
    try {
      const { contractId } = req.params;
      const ownerId = req.context!.userId;
      const data = await contractsService.getContractById(contractId, ownerId);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getExpiringContracts(req: Request, res: Response, next: NextFunction) {
    try {
      const ownerId = req.context!.userId;
      const query = expiringContractQuerySchema.parse(req.query);
      const data = await contractsService.getExpiringContracts(ownerId, query);
      return apiResponse.success(res, data);
    } catch (error) {
      next(error);
    }
  }

  async terminateContract(req: Request, res: Response, next: NextFunction) {
    try {
      const { contractId } = req.params;
      const ownerId = req.context!.userId;
      const input = terminateContractSchema.parse(req.body);
      const data = await contractsService.terminateContract(contractId, ownerId, input);
      return apiResponse.success(res, data, 'Kontrak berhasil diterminasi');
    } catch (error) {
      next(error);
    }
  }

  async renewContract(req: Request, res: Response, next: NextFunction) {
    try {
      const { contractId } = req.params;
      const ownerId = req.context!.userId;
      const input = renewContractSchema.parse(req.body);
      const data = await contractsService.renewContract(contractId, ownerId, input);
      return apiResponse.success(res, data, 'Kontrak berhasil diperpanjang');
    } catch (error) {
      next(error);
    }
  }
}

export const contractsController = new ContractsController();