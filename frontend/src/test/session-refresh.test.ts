/**
 * Session refresh: a 401 triggers ONE refresh shared by every request that failed at the same time,
 * each request is replayed once with the new token, and a failed refresh ends the session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { apiClient } from "../lib/api-client";
import {
  clearSession,
  ensureFreshToken,
  getAccessToken,
  getExpiresAt,
  onSessionEnd,
  refreshSession,
  setSession,
} from "../lib/session";
import { ApiError } from "../lib/api-error";

const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

const unauthorized = (config: InternalAxiosRequestConfig) =>
  Promise.reject(
    new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
      data: { message: "Invalid or expired authentication token" },
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
    })
  );

/** Fake server: accepts only `validToken`; records the Authorization header of every call. */
function fakeServer(validToken: string) {
  const seen: Array<{ url?: string; auth?: string }> = [];
  const adapter: AxiosAdapter = async (config) => {
    const auth = String(config.headers?.Authorization ?? "");
    seen.push({ url: config.url, auth });
    if (auth === `Bearer ${validToken}`) return ok(config, { url: config.url });
    return unauthorized(config);
  };
  return { adapter, seen };
}

describe("session refresh", () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    clearSession();
  });
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it("parallel 401s share one refresh and each request is replayed with the new token", async () => {
    setSession("old-token", Math.floor(Date.now() / 1000) + 3600);
    const server = fakeServer("new-token");
    apiClient.defaults.adapter = server.adapter;
    let resolveRefresh!: () => void;
    const post = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({ data: { token: "new-token", expiresAt: 4102444800 } } as AxiosResponse);
        })
    );

    const pending = Promise.all([apiClient.get("/a"), apiClient.get("/b"), apiClient.get("/c")]);
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    resolveRefresh();
    const results = await pending;

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
    expect(post.mock.calls[0][2]).toMatchObject({ withCredentials: true });
    expect(results.map((r) => r.data.url)).toEqual(["/a", "/b", "/c"]);
    expect(getAccessToken()).toBe("new-token");
    expect(getExpiresAt()).toBe(4102444800 * 1000);
    // 3 rejected with the old token, 3 replayed with the new one
    expect(server.seen.filter((s) => s.auth === "Bearer old-token")).toHaveLength(3);
    expect(server.seen.filter((s) => s.auth === "Bearer new-token")).toHaveLength(3);
  });

  it("a failed refresh ends the session ('expired') and the request fails with 401", async () => {
    setSession("old-token", Math.floor(Date.now() / 1000) + 3600);
    apiClient.defaults.adapter = fakeServer("never").adapter;
    vi.spyOn(axios, "post").mockRejectedValue(new Error("401"));
    const ended = vi.fn();
    const off = onSessionEnd(ended);

    const err = await apiClient.get("/x").catch((e) => e);
    off();

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(ended).toHaveBeenCalledWith("expired");
    expect(getAccessToken()).toBeNull();
  });

  it("retries only once: a second 401 after a successful refresh is returned as is", async () => {
    setSession("old-token", Math.floor(Date.now() / 1000) + 3600);
    const server = fakeServer("never");
    apiClient.defaults.adapter = server.adapter;
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { token: "new-token" } } as AxiosResponse);

    const err = await apiClient.get("/y").catch((e) => e);
    expect((err as ApiError).status).toBe(401);
    expect(post).toHaveBeenCalledTimes(1);
    expect(server.seen).toHaveLength(2);
  });

  it("never refreshes for the auth endpoints' own 401s (wrong password, bad reset link)", async () => {
    setSession("old-token", Math.floor(Date.now() / 1000) + 3600);
    apiClient.defaults.adapter = fakeServer("never").adapter;
    const post = vi.spyOn(axios, "post");
    for (const url of ["/auth/login", "/auth/reset-password"]) {
      const err = await apiClient.post(url, {}).catch((e) => e);
      expect((err as ApiError).status).toBe(401);
    }
    expect(post).not.toHaveBeenCalled();
  });

  it("does not refresh when nobody is signed in", async () => {
    apiClient.defaults.adapter = fakeServer("never").adapter;
    const post = vi.spyOn(axios, "post");
    const err = await apiClient.get("/z").catch((e) => e);
    expect((err as ApiError).status).toBe(401);
    expect(post).not.toHaveBeenCalled();
  });

  it("refreshSession never rejects and ensureFreshToken only refreshes a token close to expiry", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("no cookie"));
    await expect(refreshSession()).resolves.toBeNull();

    setSession("fresh", Math.floor(Date.now() / 1000) + 3600);
    await expect(ensureFreshToken()).resolves.toBe("fresh");

    setSession("stale", Math.floor(Date.now() / 1000) + 30);
    vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "renewed" } } as AxiosResponse);
    await expect(ensureFreshToken()).resolves.toBe("renewed");
  });

  it("the access token is never written to localStorage", async () => {
    setSession("secret-token", null);
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-token");
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.getItem(localStorage.key(i)!)).not.toContain("secret-token");
    }
  });
});
