import rateLimit from "express-rate-limit";
import { isProduction } from "../config/env";

/** Login throttle — the main brute-force surface (architecture.md §31). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 10 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Try again in 15 minutes." },
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProduction ? 300 : 5000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests. Slow down." },
});

/** Public website endpoints are unauthenticated, so they get their own tighter budget. */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProduction ? 60 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests. Slow down." },
});

export const enquiryRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProduction ? 5 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { status: "error", message: "Enquiry limit reached. Please call us instead." },
});
