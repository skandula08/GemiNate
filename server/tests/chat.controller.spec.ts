import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { socketJoin, socketLeave, socketSendMessage } from "../src/controllers/chat.controller.ts";
import { createChat } from "../src/services/chat.service.ts";
import { populateSafeUserInfo } from "../src/services/user.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

// Mock the logSocketError function so we can test error conditions in sockets
vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

/**
 * The mock game server only implements a tiny slice of GameServer,
 * and trying to call other methods will result in an error.
 */
const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this); // allows chaining
    emit = vi.fn();
  },
);

/**
 * The mock socket server only implements a tiny slice of GameServerSocket,
 * and trying to call other methods will result in an error
 */
const MockGameServerSocket = vi.fn(
  class {
    id = "mockGameServerSocket";
    rooms = new Set<string>();
    join = vi.fn();
    leave = vi.fn();
    emit = vi.fn();
    to = vi.fn(() => this); // allows chaining
  },
);

// We have to cast through Unknown because we're not actually correctly/fully
// implementing either the GameServer or GameServerSocket interfaces correctly!
// We're counting on the fact that the functions we're testing don't depend on
// functionality that we're not implementing
const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
const auth = { kind: "password" as const, username: "user1", password: "pwd1111" };
const badAuth = { kind: "password" as const, username: "user2", password: "nope" };

afterEach(() => {
  // This can be more elegantly achieved by setting mockReset: true in the vitest config
  vi.resetAllMocks();
  // Clear the rooms set so state doesn't leak between tests
  (mockSocket as unknown as { rooms: Set<string> }).rooms.clear();
});

describe("socketJoin", () => {
  it("should check auth and reject invalid auth", async () => {
    const chat = await createChat(new Date());
    await socketJoin(mockSocket, mockServer)({ auth: badAuth, payload: chat.chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid chat id", async () => {
    await socketJoin(mockSocket, mockServer)({ auth, payload: "hi" });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 accessed invalid chat id"),
    );
  });

  it("should proceed without errors, add the user to the room connection, and send chatJoined and chatUserJoined messages", async () => {
    const chat = await createChat(new Date());
    const record = await getUserByUsername(auth.username);
    const user = await populateSafeUserInfo(record!.userId);
    await socketJoin(mockSocket, mockServer)({ auth, payload: chat.chatId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatJoined", chat);
    expect(mockSocket.to).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatUserJoined", {
      chatId: chat.chatId,
      user,
    });
  });
});

describe("socketLeave", () => {
  it("should check auth and reject invalid auth", async () => {
    const chat = await createChat(new Date());
    await socketLeave(mockSocket, mockServer)({ auth: badAuth, payload: chat.chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject leaving a room the socket is not in", async () => {
    const chat = await createChat(new Date());
    await socketLeave(mockSocket, mockServer)({ auth, payload: chat.chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 left chat they weren't in"),
    );
  });

  it("should leave the room and emit chatUserLeft when in the room", async () => {
    const chat = await createChat(new Date());
    const record = await getUserByUsername(auth.username);
    const user = await populateSafeUserInfo(record!.userId);
    // Simulate the socket being in the room
    (mockSocket as unknown as { rooms: Set<string> }).rooms.add(chat.chatId);
    await socketLeave(mockSocket, mockServer)({ auth, payload: chat.chatId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.leave).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.to).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatUserLeft", {
      chatId: chat.chatId,
      user,
    });
  });
});

describe("socketSendMessage", () => {
  it("should check auth and reject invalid auth", async () => {
    const chat = await createChat(new Date());
    await socketSendMessage(
      mockSocket,
      mockServer,
    )({
      auth: badAuth,
      payload: { chatId: chat.chatId, text: "hello" },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid payload shape", async () => {
    await socketSendMessage(
      mockSocket,
      mockServer,
    )({
      auth,
      payload: "not-a-valid-payload",
    });
    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("should create a message, add it to the chat, and emit chatNewMessage via io", async () => {
    const chat = await createChat(new Date());
    await socketSendMessage(
      mockSocket,
      mockServer,
    )({
      auth,
      payload: { chatId: chat.chatId, text: "hello world" },
    });
    expect(logSocketError).not.toHaveBeenCalled();
    // io.to(chatId) should have been called on the server, not the socket
    expect(mockServer.to).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockServer.emit).toHaveBeenCalledOnce();
    const emitCall = (mockServer.emit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(emitCall[0]).toBe("chatNewMessage");
    expect(emitCall[1]).toHaveProperty("chatId", chat.chatId);
    expect(emitCall[1]).toHaveProperty("message");
    expect(emitCall[1].message).toHaveProperty("messageId");
  });
});
