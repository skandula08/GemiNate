import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

// ---------------------------------------------------------------------------
// Tests for the EXPORTED functions – mock passport at the module level so
// getGoogleAuth / getGoogleCallback use our controlled version.
// ---------------------------------------------------------------------------

// vi.hoisted runs *before* the hoisted vi.mock calls, so the reference is safe.
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}));

vi.mock("passport", () => ({
  default: {
    use: vi.fn(),
    initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    authenticate: mockAuthenticate,
  },
}));

// Mock auth.service so the module-level import doesn't pull in real DB code
vi.mock("../src/services/auth.service.ts", () => ({
  findOrCreateGoogleUser: vi.fn(),
  generateSessionToken: vi.fn(),
}));

// Mock passport-google-oauth20 so the `import { Strategy }` succeeds
vi.mock("passport-google-oauth20", () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Strategy: vi.fn(),
}));

import { getGoogleAuth, getGoogleCallback } from "../src/controllers/auth.controller.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(overrides: Partial<Request> = {}): Request {
  return { ...overrides } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {
    redirect: vi.fn(),
    status: vi.fn().mockReturnThis() as Response["status"],
    json: vi.fn().mockReturnThis() as Response["json"],
    end: vi.fn() as Response["end"],
  };
  return res as Response;
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getGoogleAuth
// ---------------------------------------------------------------------------
describe("getGoogleAuth", () => {
  it("calls passport.authenticate with 'google' and correct scopes", () => {
    const innerMiddleware = vi.fn();
    mockAuthenticate.mockReturnValue(innerMiddleware);

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    getGoogleAuth(req, res, next);

    expect(mockAuthenticate).toHaveBeenCalledWith("google", {
      scope: ["profile", "email"],
    });
    expect(innerMiddleware).toHaveBeenCalledWith(req, res, next);
  });
});

// ---------------------------------------------------------------------------
// getGoogleCallback
// ---------------------------------------------------------------------------
describe("getGoogleCallback", () => {
  it("redirects to /login when passport returns an error", () => {
    // Make authenticate capture the callback so we can invoke it manually
    mockAuthenticate.mockImplementation(
      (_strategy: string, _opts: unknown, callback: (err: unknown, user: unknown) => void) => {
        // Return a middleware that, when called, invokes the callback with an error
        return (_req: unknown, _res: unknown, _next: unknown) => {
          callback(new Error("oauth failed"), null);
        };
      },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    getGoogleCallback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("http://localhost:5173/login");
  });

  it("redirects to /login when passport returns no user", () => {
    mockAuthenticate.mockImplementation(
      (_strategy: string, _opts: unknown, callback: (err: unknown, user: unknown) => void) => {
        return (_req: unknown, _res: unknown, _next: unknown) => {
          callback(null, null);
        };
      },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    getGoogleCallback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("http://localhost:5173/login");
  });

  it("redirects to /auth/callback with token and username on success", () => {
    const fakeUser = { username: "alice", sessionToken: "tok-123" };

    mockAuthenticate.mockImplementation(
      (_strategy: string, _opts: unknown, callback: (err: unknown, user: unknown) => void) => {
        return (_req: unknown, _res: unknown, _next: unknown) => {
          callback(null, fakeUser);
        };
      },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    getGoogleCallback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      `http://localhost:5173/auth/callback?token=${encodeURIComponent("tok-123")}&username=${encodeURIComponent("alice")}`,
    );
  });

  it("correctly encodes special characters in token and username", () => {
    const fakeUser = { username: "user name&special", sessionToken: "tok=val&x" };

    mockAuthenticate.mockImplementation(
      (_strategy: string, _opts: unknown, callback: (err: unknown, user: unknown) => void) => {
        return (_req: unknown, _res: unknown, _next: unknown) => {
          callback(null, fakeUser);
        };
      },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    getGoogleCallback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      `http://localhost:5173/auth/callback?token=${encodeURIComponent("tok=val&x")}&username=${encodeURIComponent("user name&special")}`,
    );
  });
});

// ---------------------------------------------------------------------------
// GoogleStrategy registration (module-level side-effect at lines 11-31)
// ---------------------------------------------------------------------------
describe("GoogleStrategy setup", () => {
  it("registers the Google strategy when env vars are set", async () => {
    vi.resetModules();

    // Stub environment variables
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

    const mockPassportUse = vi.fn();
    const mockStrategy = vi.fn();

    vi.doMock("passport", () => ({
      default: {
        use: mockPassportUse,
        initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        authenticate: vi.fn(),
      },
    }));

    vi.doMock("passport-google-oauth20", () => ({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Strategy: mockStrategy,
    }));

    // Also mock auth.service for the fresh import
    vi.doMock("../src/services/auth.service.ts", () => ({
      findOrCreateGoogleUser: vi.fn(),
      generateSessionToken: vi.fn(),
    }));

    await import("../src/controllers/auth.controller.ts");

    expect(mockPassportUse).toHaveBeenCalledOnce();
    expect(mockStrategy).toHaveBeenCalledOnce();

    // Verify the strategy was created with the correct config
    const strategyCall = mockStrategy.mock.calls[0];
    expect(strategyCall[0]).toEqual({
      clientID: "test-client-id",
      clientSecret: "test-client-secret",
      callbackURL: "http://localhost:3000/api/auth/google/callback",
    });

    vi.unstubAllEnvs();
  });

  it("does NOT register the Google strategy when env vars are missing", async () => {
    vi.resetModules();

    // Ensure env vars are empty
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    const mockPassportUse = vi.fn();

    vi.doMock("passport", () => ({
      default: {
        use: mockPassportUse,
        initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        authenticate: vi.fn(),
      },
    }));

    vi.doMock("passport-google-oauth20", () => ({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Strategy: vi.fn(),
    }));

    vi.doMock("../src/services/auth.service.ts", () => ({
      findOrCreateGoogleUser: vi.fn(),
      generateSessionToken: vi.fn(),
    }));

    await import("../src/controllers/auth.controller.ts");

    expect(mockPassportUse).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it("invokes the GoogleStrategy verify callback on success", async () => {
    vi.resetModules();

    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

    let capturedVerifyCallback: (
      accessToken: string,
      refreshToken: string,
      profile: { id: string; displayName: string; emails?: { value: string }[] },
      done: (err: Error | null, user?: unknown) => void,
    ) => Promise<void>;

    const mockFindOrCreateGoogleUser = vi.fn().mockResolvedValue({
      username: "testuser",
      userId: "uid-1",
    });
    const mockGenerateSessionToken = vi.fn().mockResolvedValue("session-tok-abc");

    vi.doMock("passport", () => ({
      default: {
        use: vi.fn(),
        initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        authenticate: vi.fn(),
      },
    }));

    vi.doMock("passport-google-oauth20", () => ({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Strategy: class {
        constructor(_opts: unknown, verify: (...args: unknown[]) => void) {
          capturedVerifyCallback = verify as typeof capturedVerifyCallback;
        }
      },
    }));

    vi.doMock("../src/services/auth.service.ts", () => ({
      findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
      generateSessionToken: mockGenerateSessionToken,
    }));

    await import("../src/controllers/auth.controller.ts");

    // Now invoke the captured verify callback
    const mockProfile = {
      id: "google-id-123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
    };
    const done = vi.fn();

    await capturedVerifyCallback!("access-tok", "refresh-tok", mockProfile, done);

    expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(
      "google-id-123",
      "test@example.com",
      "Test User",
    );
    expect(mockGenerateSessionToken).toHaveBeenCalledWith("testuser");
    expect(done).toHaveBeenCalledWith(null, {
      username: "testuser",
      sessionToken: "session-tok-abc",
    });

    vi.unstubAllEnvs();
  });

  it("invokes done with error when the verify callback throws", async () => {
    vi.resetModules();

    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

    let capturedVerifyCallback: (
      accessToken: string,
      refreshToken: string,
      profile: { id: string; displayName: string; emails?: { value: string }[] },
      done: (err: Error | null, user?: unknown) => void,
    ) => Promise<void>;

    const testError = new Error("db failure");
    const mockFindOrCreateGoogleUser = vi.fn().mockRejectedValue(testError);

    vi.doMock("passport", () => ({
      default: {
        use: vi.fn(),
        initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        authenticate: vi.fn(),
      },
    }));

    vi.doMock("passport-google-oauth20", () => ({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Strategy: class {
        constructor(_opts: unknown, verify: (...args: unknown[]) => void) {
          capturedVerifyCallback = verify as typeof capturedVerifyCallback;
        }
      },
    }));

    vi.doMock("../src/services/auth.service.ts", () => ({
      findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
      generateSessionToken: vi.fn(),
    }));

    await import("../src/controllers/auth.controller.ts");

    const mockProfile = {
      id: "google-id-456",
      displayName: "Error User",
      emails: [{ value: "err@example.com" }],
    };
    const done = vi.fn();

    await capturedVerifyCallback!("access-tok", "refresh-tok", mockProfile, done);

    expect(done).toHaveBeenCalledWith(testError);

    vi.unstubAllEnvs();
  });

  it("uses profile.id as email fallback when profile.emails is empty", async () => {
    vi.resetModules();

    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");

    let capturedVerifyCallback: (
      accessToken: string,
      refreshToken: string,
      profile: { id: string; displayName: string; emails?: { value: string }[] },
      done: (err: Error | null, user?: unknown) => void,
    ) => Promise<void>;

    const mockFindOrCreateGoogleUser = vi.fn().mockResolvedValue({
      username: "fallbackuser",
      userId: "uid-2",
    });
    const mockGenerateSessionToken = vi.fn().mockResolvedValue("session-tok-def");

    vi.doMock("passport", () => ({
      default: {
        use: vi.fn(),
        initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        authenticate: vi.fn(),
      },
    }));

    vi.doMock("passport-google-oauth20", () => ({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Strategy: class {
        constructor(_opts: unknown, verify: (...args: unknown[]) => void) {
          capturedVerifyCallback = verify as typeof capturedVerifyCallback;
        }
      },
    }));

    vi.doMock("../src/services/auth.service.ts", () => ({
      findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
      generateSessionToken: mockGenerateSessionToken,
    }));

    await import("../src/controllers/auth.controller.ts");

    // Profile with no emails array
    const mockProfile = {
      id: "google-id-no-email",
      displayName: "No Email User",
    };
    const done = vi.fn();

    await capturedVerifyCallback!("access-tok", "refresh-tok", mockProfile, done);

    // Should fall back to profile.id as the email parameter
    expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(
      "google-id-no-email",
      "google-id-no-email",
      "No Email User",
    );
    expect(done).toHaveBeenCalledWith(null, {
      username: "fallbackuser",
      sessionToken: "session-tok-def",
    });

    vi.unstubAllEnvs();
  });
});
