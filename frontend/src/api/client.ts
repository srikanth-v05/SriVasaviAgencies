import type { Pagination } from "@/types";

/**
 * Where the API lives.
 *
 * Left unset, calls go to /api/v1 on the same origin — which is how both the dev
 * server (Vite proxy) and the Vercel deployment work, because Vercel rewrites
 * /api/* through to Render. Same-origin keeps the refresh-token cookie simple.
 *
 * Set VITE_API_URL to a full origin to call the backend directly instead; the
 * backend then needs that origin in ALLOWED_ORIGINS and COOKIE_SAMESITE=none.
 */
const BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api/v1";
const ACCESS_TOKEN_KEY = "sva_access_token";

export interface ApiEnvelope<T> {
  status: "success" | "error";
  message?: string;
  data: T;
  pagination?: Pagination;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The access token lives in memory for the session, with a sessionStorage copy
 * so a page refresh does not sign the user out. The refresh token is an httpOnly
 * cookie the browser handles for us and JavaScript never sees.
 */
let accessToken: string | null = sessionStorage.getItem(ACCESS_TOKEN_KEY);

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

type Listener = () => void;
const signedOutListeners = new Set<Listener>();

export function onSignedOut(listener: Listener): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Set when the caller is already a retry, so a failed refresh cannot loop. */
  isRetry?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** A single in-flight refresh is shared, so parallel 401s cause one refresh, not many. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      });
      if (!response.ok) return false;

      const payload = (await response.json()) as ApiEnvelope<{ accessToken: string }>;
      setAccessToken(payload.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { body, query, isRetry, headers, ...rest } = options;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      return request<T>(path, { ...options, isRetry: true });
    }
    setAccessToken(null);
    signedOutListeners.forEach((listener) => listener());
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }

  if (response.status === 204) {
    return { status: "success", data: null as T };
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.status === "error") {
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status, payload?.errors);
  }

  return payload as ApiEnvelope<T>;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Download a binary response (PDF / XLSX) with the auth header attached. */
export async function download(path: string, query?: RequestOptions["query"]): Promise<void> {
  const response = await fetch(buildUrl(path, query), {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    if (response.status === 401 && (await refreshSession())) return download(path, query);
    throw new ApiError("Could not download that file", response.status);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

