import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { ApiResponse } from "../utils/response";
import { UnauthorizedError } from "../utils/errors";
import { isProduction } from "../config/env";
import { env } from "../config/env";

const REFRESH_COOKIE = "sva_refresh";

/**
 * The refresh token is returned in an httpOnly cookie so browser clients never
 * have to store it in JavaScript-reachable storage. It is also returned in the
 * body for non-browser API clients.
 */
function cookieOptions() {
  // "strict" is right when the site and API share an origin, which is the
  // default deployment (Vercel rewrites /api through to the backend).
  //
  // If the browser calls the backend on another host, a strict cookie is simply
  // never sent — login would appear to work and then the session would die at
  // the first refresh. That setup needs COOKIE_SAMESITE=none, which browsers
  // only honour on a secure cookie.
  const sameSite = env.COOKIE_SAMESITE;

  return {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await this.authService.login(email, password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    return ApiResponse.success(res, result, "Signed in");
  };

  refresh = async (req: Request, res: Response) => {
    const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedError("No refresh token supplied");

    const tokens = await this.authService.refresh(token);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions());
    return ApiResponse.success(res, tokens);
  };

  logout = async (req: Request, res: Response) => {
    const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    await this.authService.logout(token, req.user?.sub);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return ApiResponse.success(res, null, "Signed out");
  };

  me = async (req: Request, res: Response) => {
    const user = await this.authService.me(req.user!.sub);
    return ApiResponse.success(res, user);
  };

  changePassword = async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await this.authService.changePassword(req.user!.sub, currentPassword, newPassword);
    return ApiResponse.success(res, null, "Password changed. Sign in again on your other devices.");
  };
}
