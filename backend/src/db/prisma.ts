import { PrismaClient } from "@prisma/client";
import { logger } from "../config/logger";
import { isProduction } from "../config/env";

/**
 * Single PrismaClient for the process. Prisma manages the underlying PostgreSQL
 * connection pool, so creating more than one client would multiply connections.
 */
export const prisma = new PrismaClient({
  log: isProduction ? ["warn", "error"] : ["warn", "error"],
});

/** The type of both `prisma` and the `tx` handle inside `prisma.$transaction`. */
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info("Database connection established");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database connection closed");
}
