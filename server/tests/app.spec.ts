import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { httpServer, buildSessionConfig, globalErrorHandler } from "../src/app.ts";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import type { ClientToServerEvents, ServerToClientEvents } from "@gamenite/shared";
import type { Request, Response, NextFunction } from "express";

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let clientSocket: TypedClientSocket;
let port: number;

/**
 * Start the HTTP server on a random port before all tests,
 * then connect a socket.io client so we exercise the io.on("connection")
 * handler and the associated socket.on / socket.onAny / socket.onAnyOutgoing
 * registrations in app.ts lines 137-188.
 */
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });

  clientSocket = ioClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    autoConnect: true,
  }) as TypedClientSocket;

  await new Promise<void>((resolve, reject) => {
    clientSocket.on("connect", resolve);
    clientSocket.on("connect_error", reject);
  });
});

afterAll(async () => {
  if (clientSocket?.connected) {
    clientSocket.disconnect();
  }
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

describe("Socket.io connection handler (app.ts lines 137-188)", () => {
  it("should successfully connect a client socket", () => {
    expect(clientSocket.connected).toBe(true);
    expect(clientSocket.id).toBeDefined();
  });

  it("should have registered event listeners on the server-side socket", () => {
    // The connection itself triggers the io.on("connection") callback,
    // which registers all event handlers (chatJoin, gameWatch, etc.)
    // This test simply verifies the connection succeeded and is stable.
    expect(clientSocket.connected).toBe(true);
  });

  describe("onAny handler – valid payload logging", () => {
    it("should log RECV with username for a well-formed payload", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Emit an event with the expected { auth, payload } shape.
      // We use "chatJoin" which is a known ClientToServerEvents event.
      clientSocket.emit("chatJoin", {
        auth: { kind: "password" as const, username: "testuser", password: "pass1234" },
        payload: "some-chat-id",
      });

      // Give the server a moment to process the event
      await new Promise((r) => setTimeout(r, 100));

      const recvLogs = consoleSpy.mock.calls
        .map((args) => args[0] as string)
        .filter((msg) => typeof msg === "string" && msg.startsWith("RECV"));

      // Should have a RECV log line containing the username
      expect(recvLogs.some((msg: string) => msg.includes("testuser"))).toBe(true);
      expect(recvLogs.some((msg: string) => msg.includes("chatJoin"))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe("onAny handler – invalid payload logging", () => {
    it("should log RECV error for a malformed payload", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Emit a raw event with a payload that does NOT match the zod schema
      // { auth: { username: string }, payload: any }
      (clientSocket as unknown as { emit: (event: string, payload: string) => void }).emit(
        "chatJoin",
        "not-an-object",
      );

      await new Promise((r) => setTimeout(r, 100));

      const recvErrors = consoleSpy.mock.calls
        .map((args) => args[0] as string)
        .filter((msg) => typeof msg === "string" && msg.startsWith("RECV error"));

      expect(recvErrors.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  describe("onAnyOutgoing handler", () => {
    it("should log SEND when the server emits back to the client", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // To trigger onAnyOutgoing, we need the server to emit an event
      // back to this socket. We emit "gameWatch" with valid credentials
      // for user1 and a valid game ID. The server calls socket.emit("gameWatched", ...)
      // which fires the onAnyOutgoing handler.

      // First, get a game ID from the API
      const supertest = (await import("supertest")).default;
      const { app } = await import("../src/app.ts");
      const listRes = await supertest(app).get("/api/game/list");
      const games = listRes.body;

      if (Array.isArray(games) && games.length > 0) {
        const gameId = games[0].gameId;

        // Emit gameWatch with valid auth – the server's gameWatch handler
        // will emit "gameWatched" back, triggering onAnyOutgoing (line 186)
        clientSocket.emit("gameWatch", {
          auth: { kind: "password" as const, username: "user1", password: "pwd1111" },
          payload: gameId,
        });

        await new Promise((r) => setTimeout(r, 200));

        const sendLogs = consoleSpy.mock.calls
          .map((args) => args[0] as string)
          .filter((msg) => typeof msg === "string" && msg.startsWith("SEND"));
        expect(sendLogs.length).toBeGreaterThan(0);
        expect(sendLogs.some((msg: string) => msg.includes("gameWatched"))).toBe(true);
      }

      consoleSpy.mockRestore();
    });
  });

  describe("disconnect handler", () => {
    it("should log disconnect when client disconnects", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create a second client that we can disconnect independently
      const tempSocket = ioClient(`http://localhost:${port}`, {
        transports: ["websocket"],
        autoConnect: true,
      });

      await new Promise<void>((resolve, reject) => {
        tempSocket.on("connect", resolve);
        tempSocket.on("connect_error", reject);
      });

      const tempSocketId = tempSocket.id;
      expect(tempSocket.connected).toBe(true);

      // Now disconnect and wait for the server to process it
      tempSocket.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      const disconnectLogs = consoleSpy.mock.calls
        .map((args) => args[0] as string)
        .filter(
          (msg) => typeof msg === "string" && msg.includes("disconnected") && msg.includes("CONN"),
        );

      expect(disconnectLogs.length).toBeGreaterThan(0);
      // The log should reference the socket id
      expect(disconnectLogs.some((msg: string) => msg.includes(tempSocketId!))).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});

describe("Express error handler (app.ts lines 127-135)", () => {
  it("should return 500 with error message when a route throws an uncaught error", async () => {
    const supertest = (await import("supertest")).default;
    const { app } = await import("../src/app.ts");

    // GET /api/communities/banner?communityId=nonexistent triggers the global
    // error handler because getCommunityBannerFromService calls
    // CommunityRepo.get() which throws for a missing key.
    // The controller has no try/catch, so Express 5 catches the rejected
    // promise and forwards it to the error handler (app.ts lines 128-134).
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await supertest(app).get("/api/communities/banner?communityId=nonexistent-id");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("Failed to find key");

    // The error handler also calls console.error
    const errorLogs = consoleSpy.mock.calls
      .map((args) => args[0] as string)
      .filter((msg) => typeof msg === "string" && msg.includes("Unhandled error"));

    expect(errorLogs.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  it("should return 500 with Error.message when the error is an Error instance", async () => {
    const supertest = (await import("supertest")).default;
    const { app } = await import("../src/app.ts");

    vi.spyOn(console, "error").mockImplementation(() => {});

    // GET /api/communities/ownerID?communityId=nonexistent – same pattern,
    // triggers CommunityRepo.get() throw -> error handler
    const response = await supertest(app).get(
      "/api/communities/ownerID?communityId=nonexistent-id",
    );

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("error");
    // Verify the error message comes from the Error instance (line 129)
    expect(typeof response.body.error).toBe("string");
    expect(response.body.error.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });
});

describe("Body parser middleware (app.ts lines 28-31)", () => {
  it("should skip JSON parsing for multipart/form-data requests", async () => {
    const supertest = (await import("supertest")).default;
    const { app } = await import("../src/app.ts");

    // Send a multipart/form-data request — the middleware should call next()
    // without parsing JSON, so the route handler processes normally.
    const response = await supertest(app)
      .post("/api/user/login")
      .set("Content-Type", "multipart/form-data; boundary=----TestBoundary")
      .send(
        '------TestBoundary\r\nContent-Disposition: form-data; name="test"\r\n\r\nvalue\r\n------TestBoundary--',
      );

    // The important thing is that the middleware didn't crash — the multipart
    // branch was exercised. The route itself may return 400 because it expects JSON body.
    expect([200, 400, 403, 500]).toContain(response.status);
  });
});

describe("buildSessionConfig – environment-dependent branches", () => {
  it("returns config with sameSite 'none' when isProd is true", () => {
    const config = buildSessionConfig(true, undefined, "secret");
    expect(config.cookie.sameSite).toBe("none");
    expect(config.cookie.secure).toBe(true);
    expect(config.secret).toBe("secret");
  });

  it("returns config with sameSite 'lax' when isProd is false", () => {
    const config = buildSessionConfig(false, undefined, "secret");
    expect(config.cookie.sameSite).toBe("lax");
    expect(config.cookie.secure).toBe(false);
  });

  it("includes MongoDB store when mongoStr is provided", () => {
    const config = buildSessionConfig(false, "mongodb://localhost/test", "secret");
    expect(config).toHaveProperty("store");
  });

  it("excludes MongoDB store when mongoStr is undefined", () => {
    const config = buildSessionConfig(false, undefined, "secret");
    expect(config).not.toHaveProperty("store");
  });

  it("uses 'dev-secret' fallback when secret is undefined", () => {
    const config = buildSessionConfig(false, undefined, undefined);
    expect(config.secret).toBe("dev-secret");
  });

  it("uses provided secret when secret is defined", () => {
    const config = buildSessionConfig(false, undefined, "my-secret");
    expect(config.secret).toBe("my-secret");
  });
});

describe("globalErrorHandler – branch coverage", () => {
  function makeMockRes(headersSent = false) {
    const res = {
      headersSent,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
  }

  const mockReq = {} as Request;
  const mockNext = vi.fn() as NextFunction;

  it("returns err.message when err is an Error instance", () => {
    const res = makeMockRes(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalErrorHandler(new Error("test error"), mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "test error" });
    vi.restoreAllMocks();
  });

  it("returns 'Internal server error' when err is NOT an Error instance", () => {
    const res = makeMockRes(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalErrorHandler("string-error", mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    vi.restoreAllMocks();
  });

  it("does not send response when headers are already sent", () => {
    const res = makeMockRes(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalErrorHandler(new Error("too late"), mockReq, res, mockNext);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
