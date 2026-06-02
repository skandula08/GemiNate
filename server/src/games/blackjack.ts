import {
  zBlackJackMove,
  type BlackJackView,
  type BlackJackState,
  type Card,
} from "@gamenite/shared";
import { GameService } from "./gameServiceManager.ts";
import { type GameLogic } from "./gameLogic.ts";

/**
 * Game logic for a Blackjack game.
 * Handles game setup, updates, state transitions, and player moves.
 */
export const blackJackLogic: GameLogic<BlackJackState, BlackJackView> = {
  minPlayers: 2,
  maxPlayers: 6,
  start: (numPlayers) => ({
    choosingRounds: true,
    numPlayers: numPlayers,
  }),
  update: function (
    state: BlackJackState,
    movePayload: unknown,
    playerIndex: number,
  ): BlackJackState | null {
    const move = zBlackJackMove.safeParse(movePayload);
    if (move.error) return null;
    if (state.choosingRounds) {
      if (playerIndex !== 0) return null;
      if (!Array.isArray(move.data)) return null;
      const players = state.numPlayers;
      const [numRounds, numDecks] = move.data;
      if (typeof numRounds !== "number") return null;

      let deck: Card[] = [];
      for (let d = 0; d < numDecks; d++) {
        deck = deck.concat(makeDeck());
      }
      return {
        numPlayers: players,
        currRound: 0,
        numRounds: numRounds,
        choosingRounds: false,
        dealerCards: [],
        playerCards: Array.from({ length: players }, () => []), // each player holds an array of cards, each row of the array represents a player, each column represents their cards
        deck: shuffle(deck), // the deck! unknown to players.
        currPlayer: 0, // the current player to move
        bets: Array<number>(players).fill(0), // the number of chips that have been bet for the current round, per player
        chips: Array<number>(players).fill(100),
        phase: "betting",
      };
    }
    switch (state.phase) {
      case "playing": {
        if (state.currPlayer !== playerIndex) return null;
        if (typeof move.data !== "string") return null;
        if (!["hit", "stand"].includes(move.data)) return null;
        let advancePhase: boolean = false;
        if (move.data === "stand") {
          advancePhase = nextPlayer(state);
        } else if (move.data === "hit") {
          const card = state.deck.shift();
          if (card) {
            state.playerCards[state.currPlayer].push(card);
          }
          const playerValue = evaluateCards(state.playerCards[state.currPlayer]);
          if (playerValue > 21) {
            advancePhase = nextPlayer(state);
          }
        }
        if (advancePhase) {
          state.phase = "dealer";

          while (evaluateCards(state.dealerCards) < 17) {
            const card = state.deck.shift();
            if (card) {
              state.dealerCards.push(card);
            } else break;
          }

          const dealerValue = evaluateCards(state.dealerCards);
          for (let player = 0; player < state.numPlayers; player += 1) {
            const playerValue = evaluateCards(state.playerCards[player]);
            if (playerValue <= 21) {
              if (dealerValue > 21 || dealerValue < playerValue) {
                state.chips[player] += state.bets[player];
              } else if (dealerValue > playerValue) {
                state.chips[player] -= state.bets[player];
              }
            } else {
              state.chips[player] -= state.bets[player];
            }
          }
        }
        return state;
      }
      case "dealer": {
        if (playerIndex !== 0) return null;
        if (move.data !== "nextRound") return null;
        state.currPlayer = -1;
        nextPlayer(state);
        state.currRound += 1;
        state.playerCards = Array.from({ length: state.numPlayers }, () => []); // each player holds an array of cards, each row of the array represents a player, each column represents their cards
        state.dealerCards = [];
        let deck: Card[] = [];
        for (let d = 0; d < state.deck.length / 52; d++) {
          deck = deck.concat(makeDeck());
        }
        state.deck = shuffle(deck); // the deck! unknown to players.

        state.bets = Array<number>(state.numPlayers).fill(0); // the number of chips that have been bet for the current round, per player
        state.phase = "betting";

        return state;
      }
      case "betting": {
        if (state.currPlayer !== playerIndex) return null;
        if (!Array.isArray(move.data)) return null;
        const [betCommand, betAmount] = move.data;
        if (betCommand !== "bet") return null;
        if (betAmount <= 0 || betAmount > state.chips[state.currPlayer]) return null;
        state.bets[state.currPlayer] = betAmount;
        const advancePhase = nextPlayer(state);
        if (advancePhase) {
          state.phase = "playing";
          state.currPlayer = -1;
          nextPlayer(state);
          for (let cardsToAdd = 0; cardsToAdd < 2; cardsToAdd++) {
            const dealerCard = state.deck.shift();
            if (dealerCard) {
              state.dealerCards.push(dealerCard);
            }
            state.playerCards.forEach((player) => {
              const card = state.deck.shift();
              if (card) {
                player.push(card);
              }
            });
          }
        }
        return state;
      }
    }
    return null;
  },
  isDone: function (state: BlackJackState): boolean {
    return finished(state);
  },
  viewAs: function (state: BlackJackState, playerIndex: number): BlackJackView {
    if (state.choosingRounds) {
      return {
        dealerCards: [],
        phase: "choosingRounds",
        playerCards: [],
        currPlayer: 0,
        bets: [],
        chips: [],
        numRounds: 0,
        currRound: 0,
        finished: false,
      };
    } else {
      let dealerCards: Card[] = [...state.dealerCards];
      if (state.phase === "playing" && dealerCards.length > 0) {
        dealerCards = [dealerCards[0]];
      }
      return {
        dealerCards: dealerCards,
        phase: state.phase,
        playerCards: state.playerCards,
        currPlayer: state.currPlayer,
        bets: state.bets,
        chips: state.chips,
        numRounds: state.numRounds,
        currRound: state.currRound,
        finished: finished(state),
      };
    }
  },
  tagView: (view) => ({ type: "blackjack", view }),
  describeMove: function (
    prevState: BlackJackState,
    newState: BlackJackState,
    movePayload: unknown,
    playerIndex: number,
  ): string {
    let currentRound;
    let roundsLeft = 0;

    if (!newState.choosingRounds) {
      currentRound = newState.currRound;
      roundsLeft = newState.numRounds - currentRound;
    }

    let returnValue: string;
    const move = zBlackJackMove.safeParse(movePayload);
    if (!move.success) return "";
    if (!Array.isArray(move) && typeof move === "string") {
      returnValue = move;
    } else if (typeof move.data[0] === "number") {
      returnValue = ` started a game with ${move.data[0]} rounds, and ${move.data[1]} decks of cards`;
    } else if (move.data[0] === "bet") {
      returnValue = ` ${move.data[0]} ${move.data[1]} tokens!`;
    } else if (move.data === "nextRound") {
      if (roundsLeft === 0) {
        returnValue = ` ended the game!`;
      } else {
        returnValue = ` progressed to the next round...`;
      }
    } else {
      returnValue = ` ${move.data}!`;
    }
    return returnValue;
  },
};

export const blackJackGameService = new GameService<BlackJackState, BlackJackView>(blackJackLogic);

/**
 * @returns a deck of cards, unshuffled
 */
function makeDeck(): Card[] {
  const cards: Card[] = [];
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({
        rank: makeRank(rank),
        suit: makeSuit(suit),
      });
    }
  }

  return cards;
}

/**
 * @param rank A number from 1-13 that corresponds to a playing card rank
 * @returns a properly formatted rank for playing cards
 */
function makeRank(rank: number): number | "Jack" | "King" | "Queen" | "Ace" {
  switch (rank) {
    case 1:
      return "Ace";
    case 11:
      return "Jack";
    case 12:
      return "Queen";
    case 13:
      return "King";
    default:
      return rank;
  }
}

/**
 * @param rank A number from 0-4 that corresponds to a playing card suit
 * @returns a properly formatted suit for playing cards
 */
function makeSuit(suit: number): "hearts" | "spades" | "clubs" | "diamonds" {
  const suitList: ("hearts" | "spades" | "clubs" | "diamonds")[] = [
    "hearts",
    "spades",
    "clubs",
    "diamonds",
  ];

  if (suit > 3) return "spades";

  return suitList[suit];
}

/**
 *
 * @param deck An array of Cards, which contain their rank and suit
 * @returns the array of Cards where the order is randomly rearranged
 */
function shuffle(deck: Card[]): Card[] {
  const shuffledDeck: Card[] = [...deck];
  shuffledDeck.length = deck.length;
  for (let i = 0; i < deck.length; i += 1) {
    const r = Math.floor(Math.random() * deck.length); // randomly chooses a card to switch with
    // swaps the two cards
    const tmp = shuffledDeck[i];
    shuffledDeck[i] = shuffledDeck[r];
    shuffledDeck[r] = tmp;
  }
  return shuffledDeck;
}

/**
 * Evaluates the total value of a hand in Blackjack.
 * Handles face cards (Jack, Queen, King), Ace as either 1 or 11, and numbered cards.
 * @param cards - An array of card objects that the player holds.
 * @returns The total value of the hand.
 */
function evaluateCards(cards: Card[]): number {
  let sum: number = 0;
  let numAces: number = 0;
  cards.forEach((card) => {
    if (typeof card.rank === "number") {
      sum += card.rank;
    } else if (card.rank !== "Ace") {
      sum += 10;
    } else {
      numAces += 1;
    }
  });

  for (let ace = 0; ace < numAces; ace += 1) {
    if (sum + 11 > 21) {
      sum += 1;
    } else sum += 11;
  }

  return sum;
}

/**
 * Advances to the next player in the game.
 * Skips players who have no remaining chips.
 * @param state - The current state of the Blackjack game.
 * @returns Returns true if all players have completed their turns and the round is over, false otherwise.
 */
function nextPlayer(state: BlackJackState): boolean {
  if (state.choosingRounds) return false;

  do {
    state.currPlayer++;
    if (state.currPlayer >= state.numPlayers) {
      return true;
    }
  } while (state.chips[state.currPlayer] === 0);

  return false;
}

/**
 * Determines if the game has finished.
 * The game ends if all rounds are completed or all players run out of chips.
 * @param state - The current state of the Blackjack game.
 * @returns True if the game is finished, false otherwise.
 */
function finished(state: BlackJackState): boolean {
  if (!state.choosingRounds) {
    if (
      state.currRound === state.numRounds ||
      state.chips.every((chipAmount) => chipAmount === 0)
    ) {
      return true;
    }
  }
  return false;
}
