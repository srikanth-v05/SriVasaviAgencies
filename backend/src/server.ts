import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./db/prisma";

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Sri Vasavi Agencies API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  /** Stop accepting connections, drain in-flight requests, then close the pool. */
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out after 10s, exiting");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async (error) => {
      if (error) logger.error({ err: error }, "Error while closing the HTTP server");
      await disconnectDatabase();
      process.exit(error ? 1 : 0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception — exiting");
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, "Failed to start the server");
  process.exit(1);
});
