/* TYPES FOR BLACKJACK (preliminary! might change in final version, based on implementation):

NOTES: the dealer is NOT a player. they are automated. this is because the dealer's actions are fully deterministic.
There isn't "winning" persay. The game ends when the number of rounds is equal to the round count set at the beginning of the game.

The way it works is: first, there is the betting phase. During this phase players can either place bets, or leave. They can place bets up to and including their current number of chips. Players start with 100 chips. If they choose to leave, they cannot rejoin, and they end the game with their number of chips. The player with the most chips at the end of the game wins, naturally. If a player runs out of chips, they are forcibly removed from the game. In accordance with ethical standards, this game is entirely virtual - you cannot buy in more chips, and the chips cannot be redeemed for real money.

During the next phase, the dealer draws two cards, one face up and one face down, and then deals two cards, face up, to each player.

During the next phase, every player chooses to hit or stand. Players can hit as many times as they want until they bust.

After every player has played their rounds, the dealer flips over the top card and begins dealing while their cards are < 17. Aces count as 11s no matter what for this. If the dealer busts, any player who has not busted wins their bet in profit. (return their bet, and pay it back to them - essentially, 2x).

The betting phase then starts again.
 */

import { z } from "zod";

export type BlackJackState =
  | {
      choosingRounds: true;
      numPlayers: number;
    }
  | {
      numPlayers: number;
      choosingRounds: false;
      numRounds: number;
      currRound: number;
      dealerCards: Card[];
      playerCards: Card[][]; // each player holds an array of cards, each row of the array represents a player, each column represents their cards
      deck: Card[]; // the deck! unknown to players.
      currPlayer: number; // the current player to move
      bets: number[]; // the number of chips that have been bet for the current round, per player
      chips: number[]; // each player has a certain amount of chips
      phase: "playing" | "betting" | "dealer"; // the current phase controls what's happening in the game.
    };

export type Card = {
  rank: number | "Jack" | "King" | "Queen" | "Ace"; // numbers 2-10 grant  +10, as do faces. Aces grant +1 or +11, depending on the context. If +11 would cause the player to bust, the Ace is set  to +1. otherwise, it's set to +11. For the dealer, if an Ace sets them to 17 or higher, they have to stand.
  suit: "hearts" | "spades" | "clubs" | "diamonds"; // these don't matter for gameplay, they literally only matter for visuals.
};

// Players can see all dealt cards, but not the deck!
export type BlackJackView = {
  numRounds: number;
  currRound: number;
  dealerCards: Card[]; // these cards all exist, but until every player has moved, the second one the dealer pulls is face down. after every player has moved, the dealer flips this card up. that's the "dealer" phase.
  phase: "playing" | "betting" | "dealer" | "choosingRounds"; // the current phase controls what's happening in the game.
  playerCards: Card[][]; // each player holds an array of cards, each row of the array represents a player, each column represents their cards
  currPlayer: number; // the next player to move
  bets: number[]; // players can see everyone's bets.
  chips: number[]; // each player has a certain amount of chips. the player can see everyone's chips.
  finished: boolean;
};

// when hitting, the player will draw a new card. if this causes them to bust, their turn will end. this action can be done in the PLAYING phase.
// when standing, the player will simply move onto the next turn.
// when betting, the player will bet a certain amount of their  chips, adding it to the pool.
// after every player has finished the playing phase, player 1 (index 0) must send in a "nextRound" move. This is so that players can see the state of the board
// (ie: who won or lost, and the states of chips, etc)
export type BlackJackMove = z.infer<typeof zBlackJackMove>;

export const zBlackJackMove = z.union([
  z.tuple([z.string(), z.int()]),
  z.string(),
  z.tuple([z.int().gt(0).lte(8), z.int().gte(1).lte(4)]),
]);
