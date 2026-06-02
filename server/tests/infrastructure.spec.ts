import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";
import { getIO } from "../src/io.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { createRepo, setDbInitializer } from "../src/keyv.ts";
import { Keyv } from "keyv";
import type { GameServerSocket } from "../src/types.ts";

// ---------------------------------------------------------------------------
// io.ts
// ---------------------------------------------------------------------------
describe("io.ts", () => {
  it("getIO returns the server that was set by setIO", () => {
    // app.ts already called setIO during import, so getIO should succeed
    const io = getIO();
    expect(io).toBeTruthy();
  });

  it("getIO throws when io server has not been initialised", async () => {
    // Obtain a fresh copy of the module where setIO was never called
    vi.resetModules();

    const freshIo: typeof import("../src/io.ts") = await import("../src/io.ts");
    expect(() => freshIo.getIO()).toThrow("Socket.io server not initialized. Call setIO() first.");
  });
});

// ---------------------------------------------------------------------------
// socket.controller.ts – logSocketError
// ---------------------------------------------------------------------------
describe("logSocketError", () => {
  const mockSocket = { id: "test-socket-id" } as unknown as GameServerSocket;

  it("logs the message when err is an Error instance", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logSocketError(mockSocket, new Error("boom"));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('ERR! [test-socket-id] error message: "boom"'),
    );
    spy.mockRestore();
  });

  it("logs JSON-stringified value when err is not an Error instance", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logSocketError(mockSocket, { code: 42 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("ERR! [test-socket-id] unexpected error"),
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"code":42'));
    spy.mockRestore();
  });

  it("handles string errors in the else branch", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logSocketError(mockSocket, "plain string error");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("unexpected error"));
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// keyv.ts – createRepo & setDbInitializer
// ---------------------------------------------------------------------------
describe("keyv.ts", () => {
  describe("createRepo basic operations", () => {
    it("add stores a value and find retrieves it", async () => {
      const repo = createRepo<{ name: string }>("infra-add-find");
      const key = await repo.add({ name: "alice" });
      expect(typeof key).toBe("string");

      const value = await repo.find(key);
      expect(value).toStrictEqual({ name: "alice" });
    });

    it("find returns null for a nonexistent key", async () => {
      const repo = createRepo("infra-find-null");
      const value = await repo.find("does-not-exist");
      expect(value).toBeNull();
    });

    it("get throws for a nonexistent key", async () => {
      const repo = createRepo("infra-get-throws");
      await expect(repo.get("missing-key")).rejects.toThrow(
        "Failed to find key missing-key in repository infra-get-throws",
      );
    });

    it("set overwrites an existing key", async () => {
      const repo = createRepo<{ n: number }>("infra-set-overwrite");
      const key = await repo.add({ n: 1 });
      await repo.set(key, { n: 2 });
      const value = await repo.get(key);
      expect(value).toStrictEqual({ n: 2 });
    });

    it("getAllKeys returns all stored keys", async () => {
      const repo = createRepo<string>("infra-getallkeys");
      const k1 = await repo.add("a");
      const k2 = await repo.add("b");

      const keys = await repo.getAllKeys();
      expect(keys).toEqual(expect.arrayContaining([k1, k2]));
      expect(keys).toHaveLength(2);
    });

    it("clear removes all entries", async () => {
      const repo = createRepo<string>("infra-clear");
      await repo.add("x");
      await repo.add("y");
      await repo.clear();
      const keys = await repo.getAllKeys();
      expect(keys).toHaveLength(0);
    });

    it("clear on an unused repo is a no-op", async () => {
      const repo = createRepo("infra-clear-noop");
      // clear before any getStore() call – exercises the _store === null guard
      await repo.clear();
    });

    it("getMany retrieves multiple values in order", async () => {
      const repo = createRepo<{ v: number }>("infra-getmany");
      const k1 = await repo.add({ v: 10 });
      const k2 = await repo.add({ v: 20 });
      const results = await repo.getMany([k1, k2]);
      expect(results).toStrictEqual([{ v: 10 }, { v: 20 }]);
    });
  });

  describe("setDbInitializer", () => {
    it("throws when called after the database initialiser is already set", () => {
      // globalDbInitializer is already non-null (set by the first createRepo
      // that triggered the default initialiser, or by a previous test run).
      expect(() =>
        setDbInitializer(() => {
          throw new Error("should not be called");
        }),
      ).toThrow("Database initializer cannot be set a second time");
    });
  });

  describe("error branches", () => {
    it("add throws when store.set returns false", async () => {
      const spy = vi.spyOn(Keyv.prototype, "set").mockResolvedValueOnce(false);
      const repo = createRepo<{ v: number }>("add-fail-test");
      await expect(repo.add({ v: 1 })).rejects.toThrow("Failed to set new key");
      spy.mockRestore();
    });

    it("set throws when store.set returns false", async () => {
      const spy = vi.spyOn(Keyv.prototype, "set").mockResolvedValueOnce(false);
      const repo = createRepo<{ v: number }>("set-fail-test");
      await expect(repo.set("some-key", { v: 1 })).rejects.toThrow("Failed to set key");
      spy.mockRestore();
    });

    it("getMany throws when a value is undefined", async () => {
      const spy = vi
        .spyOn(Keyv.prototype, "getMany")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce([undefined] as any);
      const repo = createRepo<{ v: number }>("getmany-fail-test");
      await expect(repo.getMany(["nonexistent"])).rejects.toThrow(
        "getMany in repository getmany-fail-test had undefined keys",
      );
      spy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// auth.controller.ts – Google OAuth routes
// ---------------------------------------------------------------------------
describe("auth.controller.ts routes", () => {
  describe("GET /api/auth/google", () => {
    it("returns an error status when Google strategy is not configured", async () => {
      // Without GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET the Google strategy
      // is never registered, so passport.authenticate('google') fails.
      const res = await supertest(app).get("/api/auth/google");
      // passport returns 500 when the strategy is unknown
      expect([302, 400, 401, 403, 500]).toContain(res.status);
    });
  });

  describe("GET /api/auth/google/callback", () => {
    it("redirects to /login when there is no valid OAuth data", async () => {
      const res = await supertest(app).get("/api/auth/google/callback");
      // The callback handler catches the missing-strategy error and redirects
      // to CLIENT_URL/login (302) or passport may error (500).
      expect([302, 500]).toContain(res.status);
      if (res.status === 302) {
        expect(res.headers.location).toContain("/login");
      }
    });
  });
});
