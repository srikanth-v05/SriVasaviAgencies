import { describe, it, expect, vi } from "vitest";
import { isTransientDatabaseError, withRetry } from "../src/db/retry";

describe("isTransientDatabaseError", () => {
  it("recognises write-contention failures", () => {
    expect(isTransientDatabaseError(new Error("write conflict"))).toBe(true);
    expect(isTransientDatabaseError(new Error("pessimistic lock retry limit reached"))).toBe(true);
    expect(isTransientDatabaseError(new Error("Deadlock found when trying to get lock"))).toBe(true);
  });

  // The class of failure a free-tier Render instance or TiDB Serverless produces
  // on the very first query after waking from idle — this is the case that was
  // reaching the browser as an unexplained 500 on login.
  it("recognises a cold connection waking up", () => {
    expect(isTransientDatabaseError(new Error("connect ECONNREFUSED 127.0.0.1:4000"))).toBe(true);
    expect(isTransientDatabaseError(new Error("connect ETIMEDOUT"))).toBe(true);
    expect(isTransientDatabaseError(new Error("read ECONNRESET"))).toBe(true);
    expect(isTransientDatabaseError(new Error("Can't reach database server at `host`"))).toBe(true);
    expect(isTransientDatabaseError(new Error("Error: P1001: Can't reach database server"))).toBe(true);
    expect(isTransientDatabaseError(new Error("PROTOCOL_CONNECTION_LOST"))).toBe(true);
  });

  it("does not treat a real answer as transient", () => {
    expect(isTransientDatabaseError(new Error("Invalid email or password"))).toBe(false);
    expect(isTransientDatabaseError(new Error("Unique constraint failed on the fields: (`email`)"))).toBe(false);
    expect(isTransientDatabaseError(new Error("Record to update not found"))).toBe(false);
  });

  it("looks inside a wrapped cause, since Prisma nests the driver error there", () => {
    const wrapped = new Error("Invalid `prisma.user.findUnique()` invocation");
    (wrapped as Error & { cause?: unknown }).cause = new Error("connect ETIMEDOUT");
    expect(isTransientDatabaseError(wrapped)).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns the result on the first try when nothing fails", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(operation, { baseDelayMs: 1 })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds once the connection recovers", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT"))
      .mockResolvedValueOnce("recovered");

    await expect(withRetry(operation, { baseDelayMs: 1 })).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("rethrows a real error immediately, without retrying", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Invalid email or password"));

    await expect(withRetry(operation, { baseDelayMs: 1 })).rejects.toThrow("Invalid email or password");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured number of attempts", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));

    await expect(withRetry(operation, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow("ETIMEDOUT");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
