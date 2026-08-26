import pinoHttp from "pino-http";
import { logger } from "../config/logger";
import { getContext } from "../utils/request-context";

/** Structured request logging (nodejs-backend-patterns: "Request Logging Middleware"). */
export const httpLogger = pinoHttp({
  logger,
  genReqId: () => getContext()?.requestId ?? "unknown",
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/api/v1/health",
  },
});
