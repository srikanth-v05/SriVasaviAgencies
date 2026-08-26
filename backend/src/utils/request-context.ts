import { AsyncLocalStorage } from "node:async_hooks";
import type { RoleName } from "../config/permissions";

export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: RoleName;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Ambient per-request identity. Services call `getContext()` to attribute audit
 * entries without every service method having to accept and forward a `user`
 * argument it does not otherwise need.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setContextUser(userId: string, userRole: RoleName): void {
  const store = storage.getStore();
  if (store) {
    store.userId = userId;
    store.userRole = userRole;
  }
}
