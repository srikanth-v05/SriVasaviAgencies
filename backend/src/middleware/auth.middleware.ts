import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";
import { roleHasPermission, type Permission, type RoleName } from "../config/permissions";
import { setContextUser } from "../utils/request-context";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: RoleName;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/** Verify the bearer access token and attach the caller to the request. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Authentication required");
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    req.user = payload;
    setContextUser(payload.sub, payload.role);
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/**
 * Authorise against the permission matrix rather than against role names, so a
 * future role only has to be added to `ROLE_PERMISSIONS` to work everywhere.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) throw new UnauthorizedError("Authentication required");

    const missing = permissions.filter((p) => !roleHasPermission(user.role, p));
    if (missing.length > 0) {
      throw new ForbiddenError(`Your role does not permit this action (${missing.join(", ")})`);
    }
    next();
  };
}

export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (!roles.includes(req.user.role)) throw new ForbiddenError("Your role does not permit this action");
    next();
  };
}
