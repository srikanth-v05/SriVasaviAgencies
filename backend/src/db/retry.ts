import { logger } from "../config/logger";

/**
 * Retry a transaction that failed for a transient, contention-related reason.
 *
 * TiDB serialises writers on a locked row. When several transactions queue on
 * the same row and one of them holds it for a while, TiDB can give up on a
 * waiter with "write conflict" or "pessimistic lock retry limit reached". Those
 * aborts are safe to replay: the transaction rolled back whole, so nothing
 * partial was written and no document number was consumed.
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
        { attempt, attempts, delay: Math.round(delay), label: options.label },
        "Transient database contention — retrying",
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
