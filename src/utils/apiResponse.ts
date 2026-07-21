import { Response } from "express";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const apiResponse = {
  success(
    res: Response,
    data: unknown,
    message = "Berhasil",
    statusCode = 200,
    meta?: PaginationMeta,
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta && { meta }),
    });
  },

  created(res: Response, data: unknown, message = "Data berhasil dibuat") {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  },

  error(
    res: Response,
    message: string,
    statusCode = 400,
    code = "ERROR",
    details?: unknown,
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      ...(details ? { details } : {}),
    });
  },
};
