import { describe, expect, it } from "vitest";
import { blackJackLogic } from "../../src/games/blackjack.ts";
import type { BlackJackState, Card } from "@gamenite/shared";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Deep-clone a state so mutation in update() doesn't leak between tests. */
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/** Run choosingRounds → betting → playing setup for a 2-player game.
 *  Returns the state at the start of the playing phase. */
function setupPlayingState(numPlayers = 2): BlackJackState {
  const start = blackJackLogic.start(numPlayers);
  // Player 0 chooses 3 rounds, 1 deck
  let state = blackJackLogic.update(start, [3, 1], 0)!;
  expect(state).not.toBeNull();
  // Each player bets
  for (let p = 0; p < numPlayers; p++) {
    state = blackJackLogic.update(state, ["bet", 10], p)!;
    expect(state).not.toBeNull();
  }
  return state;
}

/** Build a minimal non-choosingRounds state for focused unit tests. */
function makeState(
  overrides: Partial<Exclude<BlackJackState, { choosingRounds: true }>> = {},
): BlackJackState {
  const base: BlackJackState = {
    numPlayers: 2,
    choosingRounds: false as const,
    numRounds: 3,
    currRound: 0,
    dealerCards: [
      { rank: 10, suit: "hearts" },
      { rank: 8, suit: "spades" },
    ],
    playerCards: [
      [
        { rank: 5, suit: "hearts" },
        { rank: 6, suit: "spades" },
      ],
      [
        { rank: 7, suit: "clubs" },
        { rank: 8, suit: "diamonds" },
      ],
    ],
    deck: buildSmallDeck(),
    currPlayer: 0,
    bets: [10, 10],
    chips: [100, 100],
    phase: "playing",
  };
  return { ...base, ...overrides } as BlackJackState;
}

/** Build a small deck with known cards for deterministic tests. */
function buildSmallDeck(): Card[] {
  return [
    { rank: 2, suit: "hearts" },
    { rank: 3, suit: "spades" },
    { rank: 4, suit: "clubs" },
    { rank: 5, suit: "diamonds" },
    { rank: 6, suit: "hearts" },
    { rank: 7, suit: "spades" },
    { rank: 8, suit: "clubs" },
    { rank: 9, suit: "diamonds" },
    { rank: 10, suit: "hearts" },
    { rank: "Jack", suit: "spades" },
    { rank: "Queen", suit: "clubs" },
    { rank: "King", suit: "diamonds" },
    { rank: "Ace", suit: "hearts" },
  ];
}

// ─── start() ────────────────────────────────────────────────────────────────

describe("BlackJack start()", () => {
  it("should return choosingRounds state for 2 players", () => {
    const state = blackJackLogic.start(2);
    expect(state).toStrictEqual({ choosingRounds: true, numPlayers: 2 });
  });

  it("should return choosingRounds state for 6 players", () => {
    const state = blackJackLogic.start(6);
    expect(state).toStrictEqual({ choosingRounds: true, numPlayers: 6 });
  });
});

// ─── update() – choosingRounds phase ────────────────────────────────────────

describe("BlackJack update() – choosingRounds phase", () => {
  it("should transition to betting phase when player 0 sets rounds/decks", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0);
    expect(state).not.toBeNull();
    expect(state!.choosingRounds).toBe(false);
    if (!state!.choosingRounds) {
      expect(state!.phase).toBe("betting");
      expect(state!.numRounds).toBe(3);
      expect(state!.currRound).toBe(0);
      expect(state!.currPlayer).toBe(0);
      expect(state!.chips).toStrictEqual([100, 100]);
      expect(state!.bets).toStrictEqual([0, 0]);
      expect(state!.deck.length).toBe(52); // 1 deck
      expect(state!.dealerCards).toStrictEqual([]);
      expect(state!.playerCards).toStrictEqual([[], []]);
    }
  });

  it("should create multiple decks when numDecks > 1", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [2, 2], 0);
    expect(state).not.toBeNull();
    if (state && !state.choosingRounds) {
      expect(state.deck.length).toBe(104); // 2 decks
    }
  });

  it("should reject non-player-0 trying to choose rounds", () => {
    const start = blackJackLogic.start(3);
    expect(blackJackLogic.update(start, [3, 1], 1)).toBeNull();
    expect(blackJackLogic.update(start, [3, 1], 2)).toBeNull();
  });

  it("should reject a string move during choosingRounds", () => {
    const start = blackJackLogic.start(2);
    expect(blackJackLogic.update(start, "hit", 0)).toBeNull();
  });

  it("should reject invalid move payloads", () => {
    const start = blackJackLogic.start(2);
    expect(blackJackLogic.update(start, null, 0)).toBeNull();
    expect(blackJackLogic.update(start, undefined, 0)).toBeNull();
  });

  it("should initialise chips to 100 per player for varying player counts", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const start = blackJackLogic.start(n);
      const state = blackJackLogic.update(start, [1, 1], 0);
      expect(state).not.toBeNull();
      if (state && !state.choosingRounds) {
        expect(state.chips.length).toBe(n);
        expect(state.chips.every((c) => c === 100)).toBe(true);
      }
    }
  });
});

// ─── update() – betting phase ───────────────────────────────────────────────

describe("BlackJack update() – betting phase", () => {
  it("should accept bets from each player in turn", () => {
    const start = blackJackLogic.start(2);
    let state = blackJackLogic.update(start, [3, 1], 0)!;
    // Player 0 bets
    state = blackJackLogic.update(clone(state), ["bet", 10], 0)!;
    expect(state).not.toBeNull();
    if (!state.choosingRounds) {
      expect(state.bets[0]).toBe(10);
      expect(state.currPlayer).toBe(1);
    }
  });

  it("should transition to playing phase after all players bet", () => {
    const state = setupPlayingState(2);
    if (!state.choosingRounds) {
      expect(state.phase).toBe("playing");
      // Dealer should have 2 cards
      expect(state.dealerCards.length).toBe(2);
      // Each player should have 2 cards
      state.playerCards.forEach((hand) => {
        expect(hand.length).toBe(2);
      });
    }
  });

  it("should reject wrong player betting", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0)!;
    // Player 1 tries to bet when it's player 0's turn
    expect(blackJackLogic.update(clone(state), ["bet", 10], 1)).toBeNull();
  });

  it("should reject a bet of 0 or less", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0)!;
    expect(blackJackLogic.update(clone(state), ["bet", 0], 0)).toBeNull();
    expect(blackJackLogic.update(clone(state), ["bet", -5], 0)).toBeNull();
  });

  it("should reject a bet exceeding available chips", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0)!;
    expect(blackJackLogic.update(clone(state), ["bet", 101], 0)).toBeNull();
  });

  it("should accept a bet equal to all available chips", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0)!;
    const result = blackJackLogic.update(clone(state), ["bet", 100], 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.bets[0]).toBe(100);
    }
  });

  it("should reject non-bet moves during betting phase", () => {
    const start = blackJackLogic.start(2);
    const state = blackJackLogic.update(start, [3, 1], 0)!;
    expect(blackJackLogic.update(clone(state), "hit", 0)).toBeNull();
    expect(blackJackLogic.update(clone(state), "stand", 0)).toBeNull();
    expect(blackJackLogic.update(clone(state), "nextRound", 0)).toBeNull();
  });

  it("should deal cards from the deck after all bets are placed", () => {
    const start = blackJackLogic.start(2);
    let state = blackJackLogic.update(start, [3, 1], 0)!;
    if (!state.choosingRounds) {
      const deckSizeBefore = state.deck.length;
      state = blackJackLogic.update(state, ["bet", 10], 0)!;
      state = blackJackLogic.update(state, ["bet", 10], 1)!;
      if (!state.choosingRounds) {
        // 2 dealer cards + 2 * 2 player cards = 6 total drawn
        expect(state.deck.length).toBe(deckSizeBefore - 6);
      }
    }
  });
});

// ─── update() – playing phase ───────────────────────────────────────────────

describe("BlackJack update() – playing phase", () => {
  it("should allow the current player to hit and draw a card", () => {
    const state = clone(makeState({ phase: "playing", currPlayer: 0 }));
    const deckBefore = state.choosingRounds ? 0 : state.deck.length;
    const handBefore = state.choosingRounds ? 0 : state.playerCards[0].length;
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.playerCards[0].length).toBe(handBefore + 1);
      expect(result.deck.length).toBe(deckBefore - 1);
    }
  });

  it("should allow the current player to stand and advance to next player", () => {
    const state = clone(makeState({ phase: "playing", currPlayer: 0 }));
    const result = blackJackLogic.update(state, "stand", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.currPlayer).toBe(1);
    }
  });

  it("should reject the wrong player trying to move", () => {
    const state = clone(makeState({ phase: "playing", currPlayer: 0 }));
    expect(blackJackLogic.update(state, "hit", 1)).toBeNull();
    expect(blackJackLogic.update(state, "stand", 1)).toBeNull();
  });

  it("should reject non-hit/stand moves during playing phase", () => {
    const state = clone(makeState({ phase: "playing", currPlayer: 0 }));
    expect(blackJackLogic.update(state, "nextRound", 0)).toBeNull();
    expect(blackJackLogic.update(state, ["bet", 10], 0)).toBeNull();
  });

  it("should advance to the next player on bust", () => {
    // Give player 0 a hand worth 20, so one more high card busts them
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: "King", suit: "spades" },
          ],
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ],
        ],
        deck: [
          { rank: 5, suit: "hearts" }, // player 0 hits → 20 + 5 = 25, bust!
          ...buildSmallDeck(),
        ],
      }),
    );
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Player 0 busted, so play should advance
      expect(result.currPlayer).toBe(1);
    }
  });

  it("should enter dealer phase when last player stands", () => {
    const state = clone(makeState({ phase: "playing", currPlayer: 1, numPlayers: 2 }));
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
    }
  });

  it("should enter dealer phase when last player busts", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        playerCards: [
          [
            { rank: 5, suit: "hearts" },
            { rank: 6, suit: "spades" },
          ],
          [
            { rank: 10, suit: "clubs" },
            { rank: "King", suit: "diamonds" },
          ],
        ],
        deck: [
          { rank: "Queen", suit: "hearts" }, // 10+10+10 = 30, bust
          ...buildSmallDeck(),
        ],
      }),
    );
    const result = blackJackLogic.update(state, "hit", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
    }
  });

  it("should have dealer draw to 17 when entering dealer phase", () => {
    // Dealer has 10 (below 17), deck has cards that bring dealer to ≥ 17
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 5, suit: "spades" },
        ], // dealer total = 15
        deck: [
          { rank: 3, suit: "clubs" }, // dealer draws → 15 + 3 = 18 ≥ 17, stops
          { rank: 9, suit: "diamonds" },
          { rank: 10, suit: "hearts" },
        ],
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
      expect(result.dealerCards.length).toBe(3); // original 2 + drew 1
    }
  });

  it("should handle dealer phase with empty deck gracefully", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        dealerCards: [
          { rank: 2, suit: "hearts" },
          { rank: 3, suit: "spades" },
        ], // dealer total = 5, needs to draw but deck is empty
        deck: [], // empty deck!
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
      // Dealer couldn't draw because deck was empty
      expect(result.dealerCards.length).toBe(2);
    }
  });

  it("should award chips when player beats dealer", () => {
    // Player 0 has 20, player 1 stands with 15 (will bet). Dealer has 15 and draws to 18.
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        bets: [10, 10],
        chips: [100, 100],
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: "King", suit: "spades" },
          ], // 20
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ], // 15
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 5, suit: "spades" },
        ], // 15
        deck: [
          { rank: 3, suit: "clubs" }, // dealer draws → 18
          { rank: 9, suit: "diamonds" },
        ],
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Player 0 (20) beats dealer (18): gains 10 → 110
      expect(result.chips[0]).toBe(110);
      // Player 1 (15) loses to dealer (18): loses 10 → 90
      expect(result.chips[1]).toBe(90);
    }
  });

  it("should deduct chips when player busts", () => {
    // Player 0 busted (>21), player 1 has 18. Dealer has 17.
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        bets: [10, 10],
        chips: [100, 100],
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: "King", suit: "spades" },
            { rank: 5, suit: "clubs" },
          ], // 25 (bust)
          [
            { rank: 10, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ], // 18
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 7, suit: "spades" },
        ], // 17
        deck: buildSmallDeck(),
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Player 0 busted: loses 10 → 90
      expect(result.chips[0]).toBe(90);
      // Player 1 (18) beats dealer (17): gains 10 → 110
      expect(result.chips[1]).toBe(110);
    }
  });

  it("should not change chips on a tie (push)", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        bets: [10, 10],
        chips: [100, 100],
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: 8, suit: "spades" },
          ], // 18
          [
            { rank: 10, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ], // 18
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 8, suit: "spades" },
        ], // 18
        deck: buildSmallDeck(),
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Tie: chips unchanged
      expect(result.chips[0]).toBe(100);
      expect(result.chips[1]).toBe(100);
    }
  });

  it("should award all non-busted players when dealer busts", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        bets: [10, 10],
        chips: [100, 100],
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: 8, suit: "spades" },
          ], // 18
          [
            { rank: 7, suit: "clubs" },
            { rank: 9, suit: "diamonds" },
          ], // 16
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 6, suit: "spades" },
        ], // 16
        deck: [
          { rank: "King", suit: "clubs" }, // dealer draws → 16 + 10 = 26, bust!
          ...buildSmallDeck(),
        ],
      }),
    );
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.chips[0]).toBe(110); // both win
      expect(result.chips[1]).toBe(110);
    }
  });
});

// ─── update() – dealer phase ────────────────────────────────────────────────

describe("BlackJack update() – dealer phase", () => {
  it("should allow player 0 to advance with nextRound", () => {
    const state = clone(
      makeState({
        phase: "dealer",
        currPlayer: 1,
        currRound: 0,
        numRounds: 3,
      }),
    );
    const result = blackJackLogic.update(state, "nextRound", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("betting");
      expect(result.currRound).toBe(1);
      expect(result.bets).toStrictEqual([0, 0]);
      expect(result.dealerCards).toStrictEqual([]);
      expect(result.playerCards).toStrictEqual([[], []]);
    }
  });

  it("should reject non-player-0 trying to advance round", () => {
    const state = clone(makeState({ phase: "dealer" }));
    expect(blackJackLogic.update(state, "nextRound", 1)).toBeNull();
  });

  it("should reject non-nextRound moves in dealer phase", () => {
    const state = clone(makeState({ phase: "dealer" }));
    expect(blackJackLogic.update(state, "hit", 0)).toBeNull();
    expect(blackJackLogic.update(state, "stand", 0)).toBeNull();
    expect(blackJackLogic.update(state, ["bet", 10], 0)).toBeNull();
  });

  it("should reshuffle the deck on next round", () => {
    const state = clone(
      makeState({
        phase: "dealer",
        currRound: 0,
        numRounds: 3,
      }),
    );
    const result = blackJackLogic.update(state, "nextRound", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Deck should be re-created (based on deck.length / 52 decks)
      expect(result.deck.length).toBeGreaterThan(0);
    }
  });
});

// ─── update() – skipping players with 0 chips ──────────────────────────────

describe("BlackJack update() – nextPlayer skipping", () => {
  it("should skip players with 0 chips during betting", () => {
    // Player 1 has 0 chips; after player 0 bets, it should skip player 1
    const state = clone(
      makeState({
        phase: "betting",
        currPlayer: 0,
        numPlayers: 3,
        chips: [100, 0, 100],
        bets: [0, 0, 0],
        playerCards: [[], [], []],
      }),
    );
    const result = blackJackLogic.update(state, ["bet", 10], 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Should skip player 1 (0 chips) and go to player 2
      expect(result.currPlayer).toBe(2);
    }
  });

  it("should skip players with 0 chips during playing", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 3,
        chips: [100, 0, 100],
        bets: [10, 0, 10],
        playerCards: [
          [
            { rank: 5, suit: "hearts" },
            { rank: 6, suit: "spades" },
          ],
          [],
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ],
        ],
      }),
    );
    const result = blackJackLogic.update(state, "stand", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Should skip player 1 (0 chips) and go to player 2
      expect(result.currPlayer).toBe(2);
    }
  });

  it("should enter dealer phase when only remaining player stands and others have 0 chips", () => {
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        chips: [100, 0],
        bets: [10, 0],
        playerCards: [
          [
            { rank: 5, suit: "hearts" },
            { rank: 6, suit: "spades" },
          ],
          [],
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 7, suit: "spades" },
        ],
      }),
    );
    const result = blackJackLogic.update(state, "stand", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
    }
  });

  it("should skip player with 0 chips when advancing to next round", () => {
    const state = clone(
      makeState({
        phase: "dealer",
        currPlayer: 1,
        numPlayers: 3,
        chips: [0, 100, 100],
        bets: [0, 10, 10],
        playerCards: [[], [], []],
        currRound: 0,
        numRounds: 3,
      }),
    );
    const result = blackJackLogic.update(state, "nextRound", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // After nextRound, currPlayer should skip player 0 (0 chips) to player 1
      expect(result.currPlayer).toBe(1);
    }
  });
});

// ─── isDone() ───────────────────────────────────────────────────────────────

describe("BlackJack isDone()", () => {
  it("should return false during choosingRounds", () => {
    expect(blackJackLogic.isDone({ choosingRounds: true, numPlayers: 2 })).toBe(false);
  });

  it("should return false when game is still in progress", () => {
    const state = makeState({ currRound: 1, numRounds: 3, chips: [100, 100] });
    expect(blackJackLogic.isDone(state)).toBe(false);
  });

  it("should return true when currRound equals numRounds", () => {
    const state = makeState({ currRound: 3, numRounds: 3, chips: [100, 100] });
    expect(blackJackLogic.isDone(state)).toBe(true);
  });

  it("should return true when all players have 0 chips", () => {
    const state = makeState({ currRound: 1, numRounds: 3, chips: [0, 0] });
    expect(blackJackLogic.isDone(state)).toBe(true);
  });

  it("should return false when only some players have 0 chips", () => {
    const state = makeState({ currRound: 1, numRounds: 3, chips: [0, 100] });
    expect(blackJackLogic.isDone(state)).toBe(false);
  });
});

// ─── viewAs() ───────────────────────────────────────────────────────────────

describe("BlackJack viewAs()", () => {
  it("should return a choosingRounds view when state is choosingRounds", () => {
    const view = blackJackLogic.viewAs({ choosingRounds: true, numPlayers: 2 }, 0);
    expect(view.phase).toBe("choosingRounds");
    expect(view.dealerCards).toStrictEqual([]);
    expect(view.playerCards).toStrictEqual([]);
    expect(view.finished).toBe(false);
  });

  it("should hide dealer's second card during playing phase", () => {
    const state = makeState({
      phase: "playing",
      dealerCards: [
        { rank: 10, suit: "hearts" },
        { rank: "Ace", suit: "spades" },
      ],
    });
    const view = blackJackLogic.viewAs(state, 0);
    expect(view.dealerCards.length).toBe(1);
    expect(view.dealerCards[0]).toStrictEqual({ rank: 10, suit: "hearts" });
  });

  it("should show all dealer cards during dealer phase", () => {
    const state = makeState({
      phase: "dealer",
      dealerCards: [
        { rank: 10, suit: "hearts" },
        { rank: "Ace", suit: "spades" },
      ],
    });
    const view = blackJackLogic.viewAs(state, 0);
    expect(view.dealerCards.length).toBe(2);
  });

  it("should show all dealer cards during betting phase", () => {
    const state = makeState({
      phase: "betting",
      dealerCards: [
        { rank: 10, suit: "hearts" },
        { rank: "Ace", suit: "spades" },
      ],
    });
    const view = blackJackLogic.viewAs(state, 0);
    expect(view.dealerCards.length).toBe(2);
  });

  it("should expose playerCards, bets, chips, currPlayer, and round info", () => {
    const state = makeState({
      phase: "playing",
      bets: [10, 20],
      chips: [90, 80],
      currPlayer: 1,
      numRounds: 5,
      currRound: 2,
    });
    const view = blackJackLogic.viewAs(state, 0);
    expect(view.bets).toStrictEqual([10, 20]);
    expect(view.chips).toStrictEqual([90, 80]);
    expect(view.currPlayer).toBe(1);
    expect(view.numRounds).toBe(5);
    expect(view.currRound).toBe(2);
  });

  it("should correctly report finished status in view", () => {
    const ongoingState = makeState({ currRound: 1, numRounds: 3, chips: [100, 100] });
    const doneState = makeState({ currRound: 3, numRounds: 3, chips: [100, 100] });
    expect(blackJackLogic.viewAs(ongoingState, 0).finished).toBe(false);
    expect(blackJackLogic.viewAs(doneState, 0).finished).toBe(true);
  });

  it("should give the same view regardless of playerIndex (except during choosingRounds)", () => {
    const state = makeState({ phase: "dealer" });
    const view0 = blackJackLogic.viewAs(state, 0);
    const view1 = blackJackLogic.viewAs(state, 1);
    expect(view0).toStrictEqual(view1);
  });
});

// ─── tagView() ──────────────────────────────────────────────────────────────

describe("BlackJack tagView()", () => {
  it("should wrap view with type 'blackjack'", () => {
    const view = blackJackLogic.viewAs({ choosingRounds: true, numPlayers: 2 }, 0);
    expect(blackJackLogic.tagView(view)).toStrictEqual({
      type: "blackjack",
      view,
    });
  });
});

// ─── describeMove() ─────────────────────────────────────────────────────────

describe("BlackJack describeMove()", () => {
  const prevState = makeState({ currRound: 0, numRounds: 3 });
  const newState = makeState({ currRound: 0, numRounds: 3 });

  it("should describe choosingRounds move", () => {
    const desc = blackJackLogic.describeMove(prevState, newState, [3, 1], 0);
    expect(desc).toContain("3 rounds");
    expect(desc).toContain("1 decks");
  });

  it("should describe a bet", () => {
    const desc = blackJackLogic.describeMove(prevState, newState, ["bet", 25], 0);
    expect(desc).toContain("bet");
    expect(desc).toContain("25");
  });

  it("should describe hit", () => {
    const desc = blackJackLogic.describeMove(prevState, newState, "hit", 0);
    expect(desc).toContain("hit");
  });

  it("should describe stand", () => {
    const desc = blackJackLogic.describeMove(prevState, newState, "stand", 0);
    expect(desc).toContain("stand");
  });

  it("should describe nextRound when rounds remain", () => {
    const state = makeState({ currRound: 1, numRounds: 3 });
    const desc = blackJackLogic.describeMove(prevState, state, "nextRound", 0);
    expect(desc).toContain("next round");
  });

  it("should describe nextRound when game ends", () => {
    const endState = makeState({ currRound: 3, numRounds: 3 });
    const desc = blackJackLogic.describeMove(prevState, endState, "nextRound", 0);
    expect(desc).toContain("ended the game");
  });

  it("should return empty string for invalid moves", () => {
    const desc = blackJackLogic.describeMove(prevState, newState, null, 0);
    expect(desc).toBe("");
  });

  it("describeMove with invalid payload returns empty string", () => {
    const state = makeState();
    const result = blackJackLogic.describeMove(state, state, { invalid: true }, 0);
    expect(result).toBe("");
  });

  it("describeMove with array move that is not a start or bet", () => {
    const state = makeState();
    const movePayload: [string, number] = ["unknown", 10];
    const result = blackJackLogic.describeMove(state, state, movePayload, 0);
    expect(result).toContain("unknown");
  });
});

// ─── evaluateCards (tested indirectly through gameplay) ─────────────────────

describe("BlackJack card evaluation (via gameplay)", () => {
  it("should treat face cards as 10", () => {
    // Player has Jack + Queen = 20. Hit with 3 → 23, bust.
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        playerCards: [
          [
            { rank: "Jack", suit: "hearts" },
            { rank: "Queen", suit: "spades" },
          ],
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ],
        ],
        deck: [{ rank: 3, suit: "clubs" }, ...buildSmallDeck()],
      }),
    );
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // 10 + 10 + 3 = 23, busted, should advance to player 1
      expect(result.currPlayer).toBe(1);
      expect(result.playerCards[0].length).toBe(3);
    }
  });

  it("should treat Ace as 11 when it does not bust", () => {
    // Player has Ace + 6 = 17. Stand should work fine (no bust).
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        playerCards: [
          [
            { rank: "Ace", suit: "hearts" },
            { rank: 6, suit: "spades" },
          ],
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ],
        ],
      }),
    );
    // Player stands with 17 (Ace=11 + 6), no bust
    const result = blackJackLogic.update(state, "stand", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.currPlayer).toBe(1);
      expect(result.phase).toBe("playing");
    }
  });

  it("should treat Ace as 1 when 11 would bust", () => {
    // Player has 10 + 5 + Ace = 16 (Ace as 1, not 11).
    // Hit with a 5 → 21, not a bust!
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: 5, suit: "spades" },
            { rank: "Ace", suit: "clubs" },
          ], // 10+5+1=16
          [
            { rank: 7, suit: "clubs" },
            { rank: 8, suit: "diamonds" },
          ],
        ],
        deck: [{ rank: 5, suit: "diamonds" }, ...buildSmallDeck()], // hit → 16 + 5 = 21
      }),
    );
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // Should NOT bust: 10 + 5 + 1 + 5 = 21
      expect(result.currPlayer).toBe(0); // still player 0's turn
      expect(result.phase).toBe("playing");
    }
  });

  it("should handle King correctly as face card worth 10", () => {
    // Player 0: King + 9 = 19, hit with a 3 → 22, bust
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        playerCards: [
          [
            { rank: "King", suit: "hearts" },
            { rank: 9, suit: "spades" },
          ], // 19
          [
            { rank: 5, suit: "clubs" },
            { rank: 5, suit: "diamonds" },
          ],
        ],
        deck: [{ rank: 3, suit: "clubs" }, ...buildSmallDeck()], // 19 + 3 = 22, bust
      }),
    );
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.currPlayer).toBe(1); // busted, moved to next player
    }
  });

  it("should handle multiple Aces correctly", () => {
    // Two Aces: first Ace = 11, second Ace = 1 → total = 12
    // Hit with a 9 → 21, not bust
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 0,
        numPlayers: 2,
        playerCards: [
          [
            { rank: "Ace", suit: "hearts" },
            { rank: "Ace", suit: "spades" },
          ], // 11 + 1 = 12
          [
            { rank: 5, suit: "clubs" },
            { rank: 5, suit: "diamonds" },
          ],
        ],
        deck: [{ rank: 9, suit: "clubs" }, ...buildSmallDeck()], // 12 + 9 = 21
      }),
    );
    const result = blackJackLogic.update(state, "hit", 0);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      // 11 + 1 + 9 = 21, not bust
      expect(result.currPlayer).toBe(0);
      expect(result.phase).toBe("playing");
    }
  });
});

// ─── full game flow integration test ────────────────────────────────────────

describe("BlackJack full game flow", () => {
  it("should play through choosingRounds → betting → playing → dealer → next round", () => {
    // 1. Start
    const startState = blackJackLogic.start(2);
    expect(startState.choosingRounds).toBe(true);

    // 2. Choose rounds
    let state = blackJackLogic.update(startState, [3, 1], 0)!;
    expect(state).not.toBeNull();
    expect(state.choosingRounds).toBe(false);
    if (state.choosingRounds) return;
    expect(state.phase).toBe("betting");

    // 3. Players bet
    state = blackJackLogic.update(state, ["bet", 10], 0)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.currPlayer).toBe(1);

    state = blackJackLogic.update(state, ["bet", 20], 1)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.phase).toBe("playing");
    expect(state.dealerCards.length).toBe(2);
    expect(state.playerCards[0].length).toBe(2);
    expect(state.playerCards[1].length).toBe(2);

    // 4. Both players stand
    state = blackJackLogic.update(state, "stand", 0)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;

    state = blackJackLogic.update(state, "stand", 1)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.phase).toBe("dealer");

    // 5. Advance to next round
    state = blackJackLogic.update(state, "nextRound", 0)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.phase).toBe("betting");
    expect(state.currRound).toBe(1);
  });

  it("should end game when all chips reach 0", () => {
    // Setup: both players have very few chips and will lose them all
    const state = clone(
      makeState({
        phase: "playing",
        currPlayer: 1,
        numPlayers: 2,
        bets: [10, 10],
        chips: [10, 10], // Will go to 0 if they lose
        playerCards: [
          [
            { rank: 10, suit: "hearts" },
            { rank: "King", suit: "spades" },
            { rank: 5, suit: "clubs" },
          ], // 25, bust
          [
            { rank: 10, suit: "clubs" },
            { rank: "Queen", suit: "diamonds" },
            { rank: 3, suit: "hearts" },
          ], // 23, bust
        ],
        dealerCards: [
          { rank: 10, suit: "hearts" },
          { rank: 8, suit: "spades" },
        ], // 18
        deck: buildSmallDeck(),
      }),
    );

    // Player 1 (already bust from cards) stands to trigger dealer phase
    const result = blackJackLogic.update(state, "stand", 1);
    expect(result).not.toBeNull();
    if (result && !result.choosingRounds) {
      expect(result.phase).toBe("dealer");
      // Both busted: chips[0] = 10-10 = 0, chips[1] = 10-10 = 0
      expect(result.chips[0]).toBe(0);
      expect(result.chips[1]).toBe(0);
      expect(blackJackLogic.isDone(result)).toBe(true);
    }
  });

  it("should handle 3+ player game correctly", () => {
    const startState = blackJackLogic.start(3);
    let state = blackJackLogic.update(startState, [2, 1], 0)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.numPlayers).toBe(3);

    // All 3 players bet
    state = blackJackLogic.update(state, ["bet", 5], 0)!;
    state = blackJackLogic.update(state, ["bet", 10], 1)!;
    state = blackJackLogic.update(state, ["bet", 15], 2)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.phase).toBe("playing");
    expect(state.playerCards.length).toBe(3);

    // All 3 players stand
    state = blackJackLogic.update(state, "stand", 0)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    state = blackJackLogic.update(state, "stand", 1)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    state = blackJackLogic.update(state, "stand", 2)!;
    expect(state).not.toBeNull();
    if (state.choosingRounds) return;
    expect(state.phase).toBe("dealer");
  });
});

// ─── minPlayers / maxPlayers ────────────────────────────────────────────────

describe("BlackJack game metadata", () => {
  it("should have minPlayers of 2", () => {
    expect(blackJackLogic.minPlayers).toBe(2);
  });

  it("should have maxPlayers of 6", () => {
    expect(blackJackLogic.maxPlayers).toBe(6);
  });
});
