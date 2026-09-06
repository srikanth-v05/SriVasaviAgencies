import { Request, Response, NextFunction, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, ValidationError, ConflictError, NotFoundError } from "../utils/errors";
import { ApiResponse } from "../utils/response";
import { logger } from "../config/logger";
import { isProduction } from "../config/env";
import { getContext } from "../utils/request-context";

/**
 * Global error handler (nodejs-backend-patterns: "Global Error Handler").
 * Operational errors answer with their own status; anything else is logged in
 * full and reduced to a generic message in production so internals never leak.
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const normalised = normaliseError(err);

  if (normalised instanceof AppError && normalised.isOperational) {
    const errors = normalised instanceof ValidationError ? normalised.errors : undefined;
    ApiResponse.error(res, normalised.message, normalised.statusCode, errors);
    return;
  }

  logger.error({
    err: { message: err.message, stack: err.stack, name: err.name },
    url: req.originalUrl,
    method: req.method,
    requestId: getContext()?.requestId,
  }, "Unhandled error");

  ApiResponse.error(res, isProduction ? "Internal server error" : err.message, 500);
};

/** Translate framework and driver errors into the application's error vocabulary. */
function normaliseError(err: Error): Error {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new ValidationError(
      "Validation failed",
      err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        // Postgres/SQLite report `meta.target` as string[]; TiDB/MySQL report a
        // single string (the constraint name) instead — handle both shapes.
        const rawTarget = err.meta?.target;
        const target = Array.isArray(rawTarget) ? rawTarget.join(", ") : typeof rawTarget === "string" ? rawTarget : "value";
        return new ConflictError(`A record with this ${target} already exists`);
      }
      case "P2025":
        return new NotFoundError("Record not found");
      case "P2003":
        return new ConflictError("This record is referenced by other records and cannot be changed");
      default:
        return err;
    }
  }

  return err;
}

/** Catches rejections from async handlers and routes them to the error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const notFoundHandler = (req: Request, res: Response): void => {
  ApiResponse.error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};
