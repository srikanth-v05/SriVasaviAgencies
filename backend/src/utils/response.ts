import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Standard API envelope (nodejs-backend-patterns: "API Response Format"). */
export class ApiResponse {
  static success<T>(res: Response, data: T, message?: string, statusCode = 200) {
    return res.status(statusCode).json({ status: "success", message, data });
  }

  static created<T>(res: Response, data: T, message?: string) {
    return ApiResponse.success(res, data, message, 201);
  }

  static noContent(res: Response) {
    return res.status(204).send();
  }

  static error(res: Response, message: string, statusCode = 500, errors?: unknown) {
    return res.status(statusCode).json({ status: "error", message, ...(errors ? { errors } : {}) });
  }

  static paginated<T>(res: Response, data: T[], page: number, limit: number, total: number) {
    const pagination: PaginationMeta = { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
    return res.json({ status: "success", data, pagination });
  }
}
