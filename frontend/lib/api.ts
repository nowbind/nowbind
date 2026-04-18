import { toast } from "sonner";
import { API_URL } from "./constants";

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    opts?: { noRedirect?: boolean; skipRefresh?: boolean }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // Handle banned user (403)
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const message = body.error || "Access denied";
      if (message.toLowerCase().includes("suspended") || message.toLowerCase().includes("banned")) {
        toast.error("Account Suspended", {
          description: "Your account has been suspended. Contact support if you believe this is an error.",
          duration: 8000,
        });
        // Redirect to login only if not already there
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      }
      throw new ApiError(403, message, body);
    }

    if (res.status === 401) {
      if (opts?.skipRefresh) {
        throw new ApiError(401, "Unauthorized", {});
      }

      // Try refreshing the token (with mutex to prevent concurrent refreshes)
      const refreshed = await this.refreshWithLock();
      if (refreshed) {
        const retryRes = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
        if (retryRes.ok) {
          if (retryRes.status === 204) return undefined as T;
          return retryRes.json();
        }

        // Check if retry got 403 (banned after refresh)
        if (retryRes.status === 403) {
          const body = await retryRes.json().catch(() => ({}));
          const message = body.error || "Access denied";
          if (message.toLowerCase().includes("suspended") || message.toLowerCase().includes("banned")) {
            toast.error("Account Suspended", {
              description: "Your account has been suspended. Contact support if you believe this is an error.",
              duration: 8000,
            });
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
              setTimeout(() => {
                window.location.href = "/login";
              }, 2000);
            }
          }
          throw new ApiError(403, message, body);
        }

        // Retry failed with non-401 error - throw that error, don't redirect
        if (retryRes.status !== 401) {
          const body = await retryRes.json().catch(() => ({}));
          throw new ApiError(retryRes.status, body.error || retryRes.statusText, body);
        }
      }
      // Token expired and refresh failed - show toast and redirect
      if (!opts?.noRedirect && typeof window !== "undefined") {
        toast.error("Session Expired", {
          description: "Your session has expired. Please sign in again.",
          duration: 5000,
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      }
      throw new ApiError(401, "Unauthorized", {});
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || res.statusText, body);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  }

  private async refreshWithLock(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.refresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refresh(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<T>(`${path}${query}`);
  }

  /** GET without redirecting to /login on 401 - use for auth checks on public pages */
  getSilent<T>(path: string, params?: Record<string, string>): Promise<T> {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<T>(`${path}${query}`, {}, { noRedirect: true, skipRefresh: true });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const api = new ApiClient(API_URL);
