import { logger } from "../config/logger";

/**
 * Retry an operation that failed for a transient, non-business reason. Two
 * distinct causes are covered:
 *
 *   1. Write contention — TiDB serialises writers on a locked row, and can give
 *      up on a waiter with "write conflict" or "pessimistic lock retry limit
 *      reached". Safe to replay: the transaction rolled back whole.
 *
 *   2. A cold connection — a free-tier Render instance waking from idle, or
 *      TiDB Serverless compute waking from scale-to-zero, can throw a raw
 *      connection error on the very first query after a quiet period. This is
 *      what an intermittent 500 on the very first request after idle usually
 *      is: works, fails once, works again a moment later.
 *
 * Only known-transient failures are retried. A validation error, a state error
 * or a duplicate invoice number is a real answer and is rethrown at once.
 */

/** TiDB / MySQL error fragments that mean "try again", not "you did it wrong". */
const TRANSIENT_PATTERNS = [
  "write conflict",
  "pessimistic lock retry limit reached",
  "try again later",
  "deadlock",
  "lock wait timeout",
  "txnlocknotfound",
  "tikv server timeout",
  "region unavailable",
  "regionunavailable",
  "information schema is changed",
  "invalid connection",
  "connection is closed",
  "transaction not found",
  // Prisma surfaces raw driver failures under this code.
  "code: `1105`",
  "error code: 9007",

  // A cold connection waking up: a free-tier instance or a serverless database
  // that just scaled up from zero, on the very first query after being idle.
  "econnrefused",
  "econnreset",
  "etimedout",
  "enotfound",
  "socket hang up",
  "connect timeout",
  "connection lost",
  "connection terminated",
  "protocol_connection_lost",
  "server has closed the connection",
  "can't reach database server",
  "p1001",
  "p1017",
];

/**
 * Flatten an error to searchable text. Prisma nests the driver's message inside
 * its own, and sometimes behind `cause`, so a plain `error.message` check misses
 * the very string that identifies the failure as retryable.
 */
function errorText(error: unknown, depth = 0): string {
  if (depth > 4 || error === null || error === undefined) return "";

  if (typeof error === "string") return error;

  if (error instanceof Error) {
    const parts = [error.message, error.name];
    const withMeta = error as Error & { code?: unknown; meta?: unknown; cause?: unknown };
    if (withMeta.code !== undefined) parts.push(String(withMeta.code));
    if (withMeta.meta !== undefined) {
      try {
        parts.push(JSON.stringify(withMeta.meta));
      } catch {
        /* meta is not always serialisable */
      }
    }
    if (withMeta.cause) parts.push(errorText(withMeta.cause, depth + 1));
    return parts.join(" ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isTransientDatabaseError(error: unknown): boolean {
  const haystack = errorText(error).toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => haystack.includes(pattern.toLowerCase()));
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 6;
  const baseDelay = options.baseDelayMs ?? 40;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const transient = isTransientDatabaseError(error);

      if (!transient || attempt >= attempts) {
        if (transient) {
          logger.error(
            { attempts, label: options.label, err: errorText(error).slice(0, 400) },
            "Gave up after repeated database contention",
          );
        }
        throw error;
      }

      // Exponential backoff with jitter, so a burst of retries does not
      // re-collide in lockstep.
      const delay = baseDelay * 2 ** (attempt - 1) * (0.5 + Math.random());
      logger.warn(
        {
          attempt,
          attempts,
          delay: Math.round(delay),
          label: options.label,
          // Kept short and only at warn level: this is the one place the real
          // driver error is visible even when the retry succeeds, which is the
          // only way to tell a cold-start blip from write contention after the
          // fact — a "gave up" error log only fires when every retry fails.
          err: errorText(error).slice(0, 200),
        },
        "Transient database contention — retrying",
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
