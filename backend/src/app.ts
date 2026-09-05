import path from "node:path";
import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { allowedOrigins } from "./config/env";
import { requestContext } from "./middleware/request-context.middleware";
import { httpLogger } from "./middleware/logger.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { buildRouter } from "./routes";
import { ensureStorageDirs } from "./middleware/upload.middleware";
import { env } from "./config/env";

/**
 * Application assembly. Security middleware runs before anything that touches
 * the request body (nodejs-backend-patterns: "Basic Setup", architecture.md §31).
 */
export function createApp(): Application {
  const app = express();

  // Rate limiters and request logging need the real client IP behind a proxy.
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server calls arrive without an Origin header.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS policy"));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());

  app.use(requestContext);
  app.use(httpLogger);
  app.use("/api", apiRateLimiter);

  // Uploaded branding images (logo, seal, signature). Served read-only; the
  // filenames are generated server-side so nothing user-controlled is in the path.
  ensureStorageDirs();
  app.use(
    "/uploads",
    express.static(path.resolve(env.STORAGE_DIR), {
      index: false,
      dotfiles: "deny",
      maxAge: "1h",
    }),
  );

  app.get("/health", (_req, res) => res.json({ status: "success", data: { ok: true } }));
  app.use("/api/v1", buildRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
