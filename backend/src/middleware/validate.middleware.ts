import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodTypeAny } from "zod";
import { ValidationError } from "../utils/errors";

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validation middleware (nodejs-backend-patterns: "Validation Middleware").
 * Parsed output replaces the raw input, so handlers receive coerced, typed data
 * and unknown keys never reach the service layer.
 */
export function validate(schemas: RequestSchemas | AnyZodObject) {
  const normalised: RequestSchemas =
    "body" in schemas || "query" in schemas || "params" in schemas
      ? (schemas as RequestSchemas)
      : { body: schemas as ZodTypeAny };

  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: { field: string; message: string }[] = [];

    for (const key of ["body", "query", "params"] as const) {
      const schema = normalised[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        // req.query and req.params have only getters in Express 5; assign safely.
        Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
      } else {
        issues.push(
          ...result.error.issues.map((i) => ({
            field: [key, ...i.path.map(String)].join("."),
            message: i.message,
          })),
        );
      }
    }

    if (issues.length > 0) throw new ValidationError("Validation failed", issues);
    next();
  };
}
