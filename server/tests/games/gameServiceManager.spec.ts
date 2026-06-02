import { describe, expect, it } from "vitest";
import { nimLogic } from "../../src/games/nim.ts";
import { GameService } from "../../src/games/gameServiceManager.ts";

const service = new GameService(nimLogic);

const PLAYERS = ["alice", "bob"];

describe("GameService minPlayers / maxPlayers", () => {
  it("should return the logic's minPlayers value", () => {
    expect(service.minPlayers).toBe(nimLogic.minPlayers);
    expect(service.minPlayers).toBe(2);
  });

  it("should return the logic's maxPlayers value", () => {
    expect(service.maxPlayers).toBe(nimLogic.maxPlayers);
    expect(service.maxPlayers).toBe(2);
  });
});

describe("GameService create()", () => {
  it("should return an object with state and views", () => {
    const result = service.create(PLAYERS);
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("views");
  });

  it("should initialise the game state via the logic's start()", () => {
    const result = service.create(PLAYERS);
    expect(result.state).toStrictEqual({ remaining: 21, nextPlayer: 0 });
  });

  it("should include a watchers view in views", () => {
    const result = service.create(PLAYERS);
    expect(result.views).toHaveProperty("watchers");
    expect(result.views.watchers).toStrictEqual({
      type: "nim",
      view: { remaining: 21, nextPlayer: 0 },
    });
  });

  it("should include per-player views with userId and tagged view", () => {
    const result = service.create(PLAYERS);
    expect(result.views).toHaveProperty("players");
    expect(result.views.players).toHaveLength(PLAYERS.length);

    result.views.players.forEach((entry, index) => {
      expect(entry).toHaveProperty("userId", PLAYERS[index]);
      expect(entry).toHaveProperty("view");
      expect(entry.view).toStrictEqual({
        type: "nim",
        view: { remaining: 21, nextPlayer: 0 },
      });
    });
  });
});

describe("GameService update()", () => {
  it("should return new state, views, done, and moveDescription for a valid move", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 2, 0, PLAYERS);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("views");
    expect(result).toHaveProperty("done");
    expect(result).toHaveProperty("moveDescription");
  });

  it("should produce the correct updated state after a valid move", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 2, 0, PLAYERS)!;

    expect(result.state).toStrictEqual({ remaining: 19, nextPlayer: 1 });
  });

  it("should produce correct views after a valid move", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 2, 0, PLAYERS)!;

    expect(result.views.watchers).toStrictEqual({
      type: "nim",
      view: { remaining: 19, nextPlayer: 1 },
    });
    expect(result.views.players).toHaveLength(2);
    result.views.players.forEach((entry, index) => {
      expect(entry.userId).toBe(PLAYERS[index]);
      expect(entry.view).toStrictEqual({
        type: "nim",
        view: { remaining: 19, nextPlayer: 1 },
      });
    });
  });

  it("should set done to false when the game is not over", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 1, 0, PLAYERS)!;

    expect(result.done).toBe(false);
  });

  it("should set done to true when the game is over", () => {
    const endState = { remaining: 2, nextPlayer: 0 };
    const result = service.update(endState, 2, 0, PLAYERS)!;

    expect(result.done).toBe(true);
    expect(result.state).toStrictEqual({ remaining: 0, nextPlayer: 1 });
  });

  it("should include a moveDescription string", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 3, 0, PLAYERS)!;

    expect(typeof result.moveDescription).toBe("string");
    expect(result.moveDescription.length).toBeGreaterThan(0);
    expect(result.moveDescription).toContain("three tokens");
  });

  it("should return null for an invalid move (wrong player)", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 1, 1, PLAYERS);

    expect(result).toBeNull();
  });

  it("should return null for an invalid move (bad payload)", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, null, 0, PLAYERS);

    expect(result).toBeNull();
  });

  it("should return null for an invalid move (out of range)", () => {
    const { state } = service.create(PLAYERS);
    const result = service.update(state, 0, 0, PLAYERS);

    expect(result).toBeNull();
  });

  it("should return null for a move that takes more than remaining", () => {
    const lowState = { remaining: 1, nextPlayer: 0 };
    const result = service.update(lowState, 3, 0, PLAYERS);

    expect(result).toBeNull();
  });
});

describe("GameService view()", () => {
  it("should return a tagged view for a valid state and player index", () => {
    const { state } = service.create(PLAYERS);
    const view = service.view(state, 0);

    expect(view).toStrictEqual({
      type: "nim",
      view: { remaining: 21, nextPlayer: 0 },
    });
  });

  it("should return a tagged view for watcher index (-1)", () => {
    const { state } = service.create(PLAYERS);
    const view = service.view(state, -1);

    expect(view).toStrictEqual({
      type: "nim",
      view: { remaining: 21, nextPlayer: 0 },
    });
  });

  it("should throw an Error with message 'Game state does not exist' when state is null", () => {
    expect(() => service.view(null, 0)).toThrow(Error);
    expect(() => service.view(null, 0)).toThrow("Game state does not exist");
  });

  it("should throw an Error with message 'Game state does not exist' when state is undefined", () => {
    expect(() => service.view(undefined, 0)).toThrow(Error);
    expect(() => service.view(undefined, 0)).toThrow("Game state does not exist");
  });
});
