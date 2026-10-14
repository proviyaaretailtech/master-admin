import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ApiError } from "./api-error";
import { endSession, getAccessToken, refreshSession } from "./session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to attach the in-memory access token (lib/session.ts) and log requests
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.baseURL || ""}${config.url}`,
        config.data || ""
      );
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** Auth endpoints answer 401 for their own reasons (wrong password, bad reset link): never refresh on those. */
const NO_REFRESH = /\/auth\/(login|refresh|logout|forgot-password|reset-password)$/;

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

/**
 * A 401 means the access token expired (or was revoked). Refresh once (shared by every request that
 * failed at the same time) and replay the request with the new token. If the refresh fails the session
 * is over: endSession("expired") sends the person to sign-in with a "session ended" message.
 */
async function retryAfterRefresh(error: AxiosError): Promise<unknown> {
  const config = error.config as RetriableConfig | undefined;
  if (
    error.response?.status !== 401 ||
    !config ||
    config._authRetried ||
    NO_REFRESH.test(config.url ?? "") ||
    !getAccessToken()
  ) {
    return null;
  }
  config._authRetried = true;
  const token = await refreshSession();
  if (!token) {
    endSession("expired");
    return null;
  }
  config.headers.Authorization = `Bearer ${token}`;
  return { replay: await apiClient.request(config) };
}

// Interceptor to turn every failure into an ApiError (server text + errorCode + status).
// Show it to people with localizeError(err) from "../i18n/errors" so it appears in their language.
apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  async (error) => {
    const retried = (await retryAfterRefresh(error)) as { replay: unknown } | null;
    if (retried) return retried.replay;

    if (import.meta.env.DEV) {
      console.error(`[API Error] ${error.config?.url}:`, error.response?.data || error.message);
    }

    // 1. Connection / server unreachable
    if (!error.response) {
      return Promise.reject(
        new ApiError(
          "Cannot reach the backend server. Please verify the backend is running on http://localhost:8000.",
          { isNetworkError: true }
        )
      );
    }

    const status: number | undefined = error.response.status;
    const data = error.response.data ?? {};
    const errorCode: string | undefined = data.errorCode;

    // 2. Structured Zod validation errors from the backend
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const fieldErrors = data.errors
        .filter((e: { message?: string }) => Boolean(e?.message))
        .map((e: { field?: string; message: string }) => ({ field: e.field, message: e.message }));
      const messages = fieldErrors.map((e: { message: string }) => e.message).join(". ");
      return Promise.reject(
        new ApiError(messages || "Validation failed", { status, errorCode, fieldErrors })
      );
    }

    // 3. Application error message (AppError / custom message)
    if (data.message) {
      return Promise.reject(new ApiError(data.message, { status, errorCode }));
    }

    // 4. Fallback status error
    return Promise.reject(
      new ApiError(error.message || "An unexpected error occurred", { status, errorCode })
    );
  }
);
