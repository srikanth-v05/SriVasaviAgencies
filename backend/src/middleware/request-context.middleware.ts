import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { runWithContext } from "../utils/request-context";

/**
 * Opens the ambient request context for the lifetime of the request, so audit
 * writes deep in the service layer can attribute themselves to the caller.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("x-request-id", requestId);

  runWithContext(
    {
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
    () => next(),
  );
}
