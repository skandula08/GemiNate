import { GameService } from "./gameServiceManager.ts";
import { type NimState, type NimView, zNimMove } from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";

const START_NIM_OBJECTS = 21;

/** Human-readable token count */
function tokenWord(n: number): string {
  if (n === 1) return "one token";
  if (n === 2) return "two tokens";
  if (n === 3) return "three tokens";
  return `${n} tokens`;
}

export const nimLogic: GameLogic<NimState, NimView> = {
  minPlayers: 2,
  maxPlayers: 2,
  start: () => ({ remaining: START_NIM_OBJECTS, nextPlayer: 0 }),
  update: ({ remaining, nextPlayer }, payload, playerIndex) => {
    const move = zNimMove.safeParse(payload);
    if (playerIndex !== nextPlayer) return null;
    if (move.error) return null;
    if (move.data > remaining) return null;
    return {
      remaining: remaining - move.data,
      nextPlayer: nextPlayer === 0 ? 1 : 0,
    };
  },
  isDone: ({ remaining }) => remaining === 0,
  viewAs: (state) => state,
  tagView: (view) => ({ type: "nim", view }),
  describeMove: (_prevState, newState, payload) => {
    const move = zNimMove.parse(payload);
    const took = tokenWord(move);
    if (newState.remaining === 0) {
      return ` took ${took} and lost the game`;
    }
    return ` took ${took}, leaving ${newState.remaining}`;
  },
};

export const nimGameService = new GameService<NimState, NimView>(nimLogic);
