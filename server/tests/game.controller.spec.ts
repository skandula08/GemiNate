import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketWatch,
  socketJoinAsPlayer,
  socketStart,
  socketMakeMove,
} from "../src/controllers/game.controller.ts";
import { createGame, joinGame } from "../src/services/game.service.ts";
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
    join = vi.fn();
    rooms = new Set<string>();
    emit = vi.fn();
    to = vi.fn(() => this); // allows chaining
  },
);

// We have to cast through Unknown because we're not actually correctly/fully
// implementing either the GameServer or GameServerSocket interfaces correctly!
const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
const auth1 = { kind: "password" as const, username: "user1", password: "pwd1111" };
const auth2 = { kind: "password" as const, username: "user2", password: "pwd2222" };
const badAuth = { kind: "password" as const, username: "user1", password: "nope" };

afterEach(() => {
  vi.resetAllMocks();
});

// --- socketWatch ---

describe("socketWatch", () => {
  it("should reject invalid auth", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());
    await socketWatch(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject a malformed body (missing payload)", async () => {
    await socketWatch(mockSocket, mockServer)({ auth: auth1 });
    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("should reject an invalid game id", async () => {
    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: "nonexistent-id" });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 viewed an invalid game id"),
    );
  });

  it("should join both the game room and the user room when watching as a player", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith([
      game.gameId,
      `${game.gameId}-${user1!.userId}`,
    ]);
  });

  it("should join only the game room when watching as a non-player", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());

    // user2 is not a player in this game
    const auth2 = { kind: "password" as const, username: "user2", password: "pwd2222" };
    await socketWatch(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith([game.gameId]);
  });

  it("should emit 'gameWatched' with gameId, view, and players", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledExactlyOnceWith("gameWatched", {
      gameId: game.gameId,
      view: null, // game hasn't started yet, so view is null
      players: game.players,
    });
  });

  it("should emit a non-null view for a started game", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());
    await joinGame(game.gameId, user2!);

    // Watch as user1 (player index 0)
    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    // The game hasn't been started yet - it's waiting. Start it first via socketStart to get a view.
    // Actually, let's test watching a waiting game vs started game separately.
    // We need to start the game to get a non-null view.
    // Use the startGame service directly.
    const { startGame } = await import("../src/services/game.service.ts");
    await startGame(game.gameId, user1!);

    vi.resetAllMocks();
    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    const emitCall = vi.mocked(mockSocket.emit).mock.calls[0];
    expect(emitCall[0]).toBe("gameWatched");
    const payload = emitCall[1] as { gameId: string; view: unknown; players: unknown[] };
    expect(payload.gameId).toBe(game.gameId);
    expect(payload.view).not.toBeNull();
    expect(payload.view).toMatchObject({ type: "nim" });
    expect(payload.players).toHaveLength(2);
  });
});

// --- socketJoinAsPlayer ---

describe("socketJoinAsPlayer", () => {
  it("should reject invalid auth", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid game id", async () => {
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth1, payload: "nonexistent-id" });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 joining invalid game"),
    );
  });

  it("should reject joining a game the user is already in", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 joining game they are in already"),
    );
  });

  it("should emit 'gamePlayersUpdated' to the game room on successful join", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());

    // user2 joins
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    // io.to(gameId).emit("gamePlayersUpdated", game.players)
    expect(vi.mocked(mockServer.to)).toHaveBeenCalledWith(game.gameId);
    expect(vi.mocked(mockServer.emit)).toHaveBeenCalledWith(
      "gamePlayersUpdated",
      expect.arrayContaining([
        expect.objectContaining({ username: "user1" }),
        expect.objectContaining({ username: "user2" }),
      ]),
    );
  });

  it("should join the user-specific room if not already in it", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());

    // mockSocket.rooms does not contain the user room
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith(`${game.gameId}-${user2!.userId}`);
  });

  it("should not re-join user room if the socket is already in it", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());

    // Pre-add the user room to the mock socket's rooms
    const userRoom = `${game.gameId}-${user2!.userId}`;
    (mockSocket as unknown as { rooms: Set<string> }).rooms.add(userRoom);

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should auto-start the game when it becomes full (nim: 2 players)", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());

    // user2 joins, making the nim game full (2/2 players)
    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();

    // sendViewUpdates should have been called: io.to(gameId) for watchers + io.to(userRoom) for each player
    const toCalls = vi.mocked(mockServer.to).mock.calls.map((c) => c[0]);
    // First call: io.to(gameId).emit("gamePlayersUpdated", ...)
    expect(toCalls[0]).toBe(game.gameId);
    // After auto-start, sendViewUpdates is called:
    // io.to(gameId).emit("gameStateUpdated", ...) for watchers
    expect(toCalls[1]).toBe(game.gameId);
    // io.to(userRoom(gameId, player1)).emit("gameStateUpdated", ...) for player 1
    expect(toCalls[2]).toBe(`${game.gameId}-${user1!.userId}`);
    // io.to(userRoom(gameId, player2)).emit("gameStateUpdated", ...) for player 2
    expect(toCalls[3]).toBe(`${game.gameId}-${user2!.userId}`);

    // Verify gameStateUpdated emissions
    const emitCalls = vi.mocked(mockServer.emit).mock.calls;
    // First emit: gamePlayersUpdated
    expect(emitCalls[0][0]).toBe("gamePlayersUpdated");
    // Second emit: gameStateUpdated for watchers
    expect(emitCalls[1][0]).toBe("gameStateUpdated");
    expect(emitCalls[1][1]).toMatchObject({ forPlayer: false, type: "nim" });
    // Third emit: gameStateUpdated for player 1
    expect(emitCalls[2][0]).toBe("gameStateUpdated");
    expect(emitCalls[2][1]).toMatchObject({ forPlayer: true, type: "nim" });
    // Fourth emit: gameStateUpdated for player 2
    expect(emitCalls[3][0]).toBe("gameStateUpdated");
    expect(emitCalls[3][1]).toMatchObject({ forPlayer: true, type: "nim" });
  });
});

// --- socketStart ---

describe("socketStart", () => {
  it("should reject invalid auth", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());
    await socketStart(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid game id", async () => {
    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: "nonexistent-id" });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 starting invalid game"),
    );
  });

  it("should reject starting a game with too few players", async () => {
    const user1 = await getUserByUsername("user1");
    const game = await createGame(user1!, "nim", new Date());

    // Only 1 player, nim requires 2
    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 starting underpopulated game"),
    );
  });

  it("should reject starting a game the user is not in", async () => {
    const user1 = await getUserByUsername("user1");
    const user3 = await getUserByUsername("user3");
    const game = await createGame(user1!, "nim", new Date());
    await joinGame(game.gameId, user3!);

    // user2 is not in the game
    await socketStart(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user2 starting game they're not in"),
    );
  });

  it("should send view updates to watchers and each player on successful start", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());
    await joinGame(game.gameId, user2!);

    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();

    // sendViewUpdates: io.to(gameId) for watchers, io.to(userRoom) for each player
    const toCalls = vi.mocked(mockServer.to).mock.calls.map((c) => c[0]);
    expect(toCalls[0]).toBe(game.gameId); // watchers
    expect(toCalls[1]).toBe(`${game.gameId}-${user1!.userId}`); // player 1
    expect(toCalls[2]).toBe(`${game.gameId}-${user2!.userId}`); // player 2

    const emitCalls = vi.mocked(mockServer.emit).mock.calls;
    // Watcher update
    expect(emitCalls[0][0]).toBe("gameStateUpdated");
    expect(emitCalls[0][1]).toMatchObject({ forPlayer: false, type: "nim" });
    // Player 1 update
    expect(emitCalls[1][0]).toBe("gameStateUpdated");
    expect(emitCalls[1][1]).toMatchObject({ forPlayer: true, type: "nim" });
    // Player 2 update
    expect(emitCalls[2][0]).toBe("gameStateUpdated");
    expect(emitCalls[2][1]).toMatchObject({ forPlayer: true, type: "nim" });
  });

  it("should reject starting an already-started game", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());
    await joinGame(game.gameId, user2!);

    // Start the game first
    const { startGame } = await import("../src/services/game.service.ts");
    await startGame(game.gameId, user1!);

    // Try to start again
    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 starting game that started"),
    );
  });
});

// --- socketMakeMove ---

describe("socketMakeMove", () => {
  /**
   * Helper: create a nim game with 2 players, start it, and return the game info.
   */
  async function createStartedNimGame() {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    const game = await createGame(user1!, "nim", new Date());
    await joinGame(game.gameId, user2!);
    const { startGame } = await import("../src/services/game.service.ts");
    await startGame(game.gameId, user1!);
    return { game, user1: user1!, user2: user2! };
  }

  it("should reject invalid auth", async () => {
    const { game } = await createStartedNimGame();
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: badAuth,
      payload: { gameId: game.gameId, move: 1 },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid game id", async () => {
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: "nonexistent-id", move: 1 },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 acted on an invalid game"),
    );
  });

  it("should reject a malformed payload (missing move)", async () => {
    const { game } = await createStartedNimGame();
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId },
    });
    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("should reject a move by a player who is not in the game", async () => {
    const { game } = await createStartedNimGame();
    const auth3 = { kind: "password" as const, username: "user3", password: "pwd3333" };
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth3,
      payload: { gameId: game.gameId, move: 1 },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user3 made a move in a game they weren't playing"),
    );
  });

  it("should reject an invalid move (taking more tokens than remain)", async () => {
    const { game } = await createStartedNimGame();
    // Nim starts with 21 tokens, max move is 3
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 5 },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 made an invalid move in nim"),
    );
  });

  it("should reject a move when it is not the player's turn", async () => {
    const { game } = await createStartedNimGame();
    // Nim starts with nextPlayer: 0, which is user1. user2 tries to move.
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth2,
      payload: { gameId: game.gameId, move: 1 },
    });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user2 made an invalid move in nim"),
    );
  });

  it("should send view updates to watchers and players on a valid move", async () => {
    const { game, user1, user2 } = await createStartedNimGame();

    // user1 (player 0) takes 1 token
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 1 },
    });

    expect(logSocketError).not.toHaveBeenCalled();

    // sendViewUpdates: io.to(gameId) for watchers, io.to(userRoom) for each player
    const toCalls = vi.mocked(mockServer.to).mock.calls.map((c) => c[0]);
    expect(toCalls[0]).toBe(game.gameId); // watchers
    expect(toCalls[1]).toBe(`${game.gameId}-${user1.userId}`); // player 1
    expect(toCalls[2]).toBe(`${game.gameId}-${user2.userId}`); // player 2

    const emitCalls = vi.mocked(mockServer.emit).mock.calls;
    // Watcher update
    expect(emitCalls[0][0]).toBe("gameStateUpdated");
    expect(emitCalls[0][1]).toMatchObject({ forPlayer: false, type: "nim" });
    // Player 1 update
    expect(emitCalls[1][0]).toBe("gameStateUpdated");
    expect(emitCalls[1][1]).toMatchObject({ forPlayer: true, type: "nim" });
    // Player 2 update
    expect(emitCalls[2][0]).toBe("gameStateUpdated");
    expect(emitCalls[2][1]).toMatchObject({ forPlayer: true, type: "nim" });
  });

  it("should broadcast a chatMoveLog entry to the chat room after a valid move", async () => {
    const { game } = await createStartedNimGame();

    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 2 },
    });

    expect(logSocketError).not.toHaveBeenCalled();

    const emitCalls = vi.mocked(mockServer.emit).mock.calls;
    // The last emit should be chatMoveLog
    const chatMoveLogCall = emitCalls.find(([event]) => event === "chatMoveLog");
    expect(chatMoveLogCall).toBeDefined();
    expect(chatMoveLogCall![0]).toBe("chatMoveLog");
    expect(chatMoveLogCall![1]).toMatchObject({
      chatId: game.chat,
      moveDescription: expect.stringContaining("two tokens"),
      user: expect.objectContaining({ username: "user1" }),
      createdAt: expect.anything(),
    });

    // Verify io.to was called with the chatId for the chatMoveLog broadcast
    const toCalls = vi.mocked(mockServer.to).mock.calls.map((c) => c[0]);
    expect(toCalls).toContain(game.chat);
  });

  it("should include correct nim game view data after a move", async () => {
    const { game } = await createStartedNimGame();

    // user1 takes 3 tokens from the initial 21
    await socketMakeMove(
      mockSocket,
      mockServer,
    )({
      auth: auth1,
      payload: { gameId: game.gameId, move: 3 },
    });

    expect(logSocketError).not.toHaveBeenCalled();

    const emitCalls = vi.mocked(mockServer.emit).mock.calls;
    // The watcher view should reflect 18 remaining (21 - 3)
    const watcherUpdate = emitCalls.find(
      ([event, payload]) =>
        event === "gameStateUpdated" &&
        typeof payload === "object" &&
        payload !== null &&
        "forPlayer" in payload &&
        !(payload as { forPlayer: boolean }).forPlayer,
    );
    expect(watcherUpdate).toBeDefined();
    expect(watcherUpdate![1]).toMatchObject({
      type: "nim",
      view: { remaining: 18, nextPlayer: 1 },
      forPlayer: false,
    });
  });
});
