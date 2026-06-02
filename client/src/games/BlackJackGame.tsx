import type { BlackJackMove, BlackJackView, Card, SafeUserInfo } from "@gamenite/shared";
import type { GameProps } from "../util/types.ts";
import React from "react";
import "./BlackJackGame.css";

/**
 *  Function to get the character representation of the rank.
 * @param rank - The rank of the card.
 * @returns The character representing the card rank. */

function getRankCharacter(rank: string | number) {
  if (!rank) return "JO";
  if (rank === "King") {
    return "K";
  } else if (rank === "Queen") {
    return "Q";
  } else if (rank === "Jack") {
    return "J";
  } else if (rank === "Ace") {
    return "A";
  } else if (rank === 10) {
    return "T";
  } else {
    return rank;
  }
}

/**
 * Function to get the character representation of the suit.
 *
 * @param suit - The suit of the card.
 * @returns The character representing the suit.
 */
function getSuitCharacter(suit: string) {
  if (!suit) return "B";
  if (suit === "spades") {
    return "S";
  } else if (suit === "hearts") {
    return "H";
  } else if (suit === "diamonds") {
    return "D";
  } else {
    return "C";
  }
}

/**
 * Component to display a card as an SVG image.
 *
 * @param card - The card to display.
 * @returns The rendered SVG of the card.
 */
function SvgCardView({ card }: { card: Card }) {
  const rank = getRankCharacter(card.rank);
  const suit = getSuitCharacter(card.suit);
  const cardName: string = "" + rank + "" + suit;
  return (
    <span>
      <img
        className="card"
        src={`/assets/cards/${cardName}.svg`}
        alt={`${card.rank} of ${card.suit}`}
        title={`${card.rank} of ${card.suit}`}
        width={"50px"}
        height={"70px"}
      />
    </span>
  );
}

/**
 * Component to display a hole card (hidden card).
 *
 * @returns The rendered hole card (question mark).
 */
function HoleView() {
  return <span className="hole">?</span>;
}

/**
 * Function to get the phase text to display based on the current game phase.
 *
 * @param phase - The current game phase.
 * @returns The corresponding phase text.
 */
function getPhaseText(phase: "playing" | "betting" | "dealer" | "choosingRounds") {
  switch (phase) {
    case "playing":
      return "Play your hands!";
    case "betting":
      return "Get betting!";
    case "dealer":
      return "Dealer's turn!";
    case "choosingRounds":
      break;
  }
  return "";
}

/**
 * Function to evaluate the sum of a player's cards.
 *
 * @param cards - The list of cards to evaluate.
 * @returns The total value of the cards.
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
 * Function to convert the card value to a string.
 *
 * @param evaluation - The evaluation of the player's cards.
 * @returns The string representation of the evaluation.
 */
function cardsValueToString(evaluation: number): string {
  if (evaluation === 21) return "Blackjack!";
  return evaluation > 21 ? "Busted!" : evaluation.toString() + " points";
}

/**
 * Function to determine the betting outcome based on card values.
 *
 * @param playerEvaluation - The player's total card value.
 * @param dealerEvaluation - The dealer's total card value.
 * @param betAmount - The amount the player has bet.
 * @returns The outcome of the bet.
 */
function cardsValueToBetState(
  playerEvaluation: number,
  dealerEvaluation: number,
  betAmount: number,
): string {
  let win = false;
  if (dealerEvaluation > 21) {
    if (playerEvaluation > 21) win = false;
    else win = true;
  } else {
    if (playerEvaluation > 21 || playerEvaluation < dealerEvaluation) win = false;
    else if (playerEvaluation === dealerEvaluation) return "It's a tie! No chips lost or gained.";
    else win = true;
  }

  return win ? "You win! +" + betAmount + " chips." : "You lose! -" + betAmount + " chips.";
}

/**
 * Function to determine the winner based on the current scores.
 *
 * @param view - The game state.
 * @param players - List of players.
 * @returns The winner's name and score.
 */
function getWinner(view: BlackJackView, players: SafeUserInfo[]): string {
  if (view.chips.every((chipAmount) => chipAmount === 0)) {
    return "Every player was bankrupted...";
  }
  const bestScore = Math.max(...view.chips);
  const winningIndices = [];
  for (let chipIndex = 0; chipIndex < view.chips.length; chipIndex += 1) {
    if (view.chips[chipIndex] === bestScore) {
      winningIndices.push(chipIndex);
    }
  }
  if (winningIndices.length === view.chips.length) {
    return "Every player earned " + bestScore.toString() + " chips!\nIt was a tie!";
  }
  if (winningIndices.length > 1) {
    let winString = "The following players win, with " + bestScore + " chips:";
    winningIndices.forEach((index) => {
      winString += "\n";
      winString += players[index].display;
    });
    return winString;
  } else {
    return players[winningIndices[0]].display + " wins with " + bestScore + " chips.";
  }
}

/**
 * Component to render a player's hand.
 *
 * @param name - The name of the player.
 * @param cards - The player's cards.
 * @param chips - The player's total chips.
 * @param bet - The amount the player has bet.
 * @param highlight - Whether to highlight the player's hand.
 * @returns The player's hand.
 */
function PlayerHand({
  name,
  cards,
  chips,
  bet,
  highlight,
}: {
  name: string;
  cards: Card[];
  chips: number;
  bet: number;
  highlight?: boolean;
}) {
  return (
    <div className={`playerHand ${highlight ? "currentPlayer" : ""}`}>
      <b>{name}</b>
      <p>Chips: {chips}</p>
      <p>Bet: {bet}</p>
      <div className="cards">
        {cards.map((card, i) => (
          <SvgCardView key={i} card={card} />
        ))}
      </div>
    </div>
  );
}

/**
 * Component to select the number of rounds and decks.
 *
 * @param onSelect - Function to call when rounds and decks are selected.
 * @returns The round and deck selector.
 */
function RoundsSelector({ onSelect }: { onSelect: (numRounds: number, numDecks: number) => void }) {
  const [numRounds, setNumRounds] = React.useState(1);
  const [numDecks, setNumDecks] = React.useState(1);
  return (
    <div>
      <div>
        <div>Rounds ({numRounds}):</div>
        1
        <input
          type="range"
          min={1}
          max={8}
          value={numRounds}
          onChange={(e) => setNumRounds(Number(e.target.value))}
        />
        8
      </div>
      <div>
        <div>Decks ({numDecks}):</div>
        1
        <input
          type="range"
          min={1}
          max={4}
          value={numDecks}
          onChange={(e) => setNumDecks(Number(e.target.value))}
        />
        4
      </div>
      <button onClick={() => onSelect(numRounds, numDecks)} className="betButton">
        Start Game
      </button>
    </div>
  );
}

/**
 * Component to control betting during the game.
 *
 * @param userPlayerIndex - The index of the current user.
 * @param currentPlayer - The index of the player whose turn it is.
 * @param chips - List of chip amounts for each player.
 * @param makeMove - Function to make a move in the game.
 * @returns The betting controls component.
 */
function BettingControls({
  userPlayerIndex,
  currentPlayer,
  chips,
  makeMove,
}: {
  userPlayerIndex: number;
  currentPlayer: number;
  chips: number[];
  makeMove: (move: [string, number]) => void;
}) {
  const [betAmount, setBetAmount] = React.useState(0);
  const [warnUser, setWarnUser] = React.useState(false);

  if (userPlayerIndex !== currentPlayer) {
    return <p>Waiting for other players to bet...</p>;
  }

  return (
    <div className="bettingSection">
      <dialog
        open={warnUser}
        onClose={() => setWarnUser(false)}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "8px",
        }}
      >
        <p>
          WARNING: You are placing a{" "}
          <span style={{ color: "red", fontWeight: "bold" }}>LARGE BET!</span>
          <br />
          Are you sure you want to bet {betAmount} chips?
        </p>
        <button onClick={() => setWarnUser(false)} className="resetButton">
          Cancel
        </button>
        <button
          onClick={() => {
            if (betAmount > 0 && betAmount <= chips[userPlayerIndex]) {
              makeMove(["bet", betAmount]);
              setBetAmount(0);
            }
            setWarnUser(false);
          }}
        >
          Place Bet
        </button>
      </dialog>
      <div>
        <br />
        <p>Your chips: {chips[userPlayerIndex]}</p>
        <p>Your bet: {betAmount}</p>
        <div className="betting-buttons-container">
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(Math.min(chips[userPlayerIndex], betAmount + 1));
            }}
          >
            ⚪ +1 Chip
          </button>
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(Math.min(chips[userPlayerIndex], betAmount + 5));
            }}
          >
            🔴 +5 Chips
          </button>
        </div>
        <div className="betting-buttons-container">
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(Math.min(chips[userPlayerIndex], betAmount + 25));
            }}
          >
            🟢 +25 Chips
          </button>
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(Math.min(chips[userPlayerIndex], betAmount + 100));
            }}
          >
            ⚫ +100 Chips
          </button>
        </div>
        <div className="betting-buttons-container">
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(chips[userPlayerIndex]);
            }}
          >
            💸 BET ALL!
          </button>
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(Math.floor(chips[userPlayerIndex] / 2));
            }}
          >
            🪙 Bet half
          </button>
        </div>
        <span className="submitBetButtons">
          <button
            disabled={warnUser}
            onClick={() => {
              setBetAmount(0);
            }}
            className="resetButton"
          >
            Reset
          </button>
          <button
            disabled={betAmount <= 0 || betAmount > chips[userPlayerIndex] || warnUser}
            onClick={() => {
              if (betAmount > chips[userPlayerIndex] / 2 || betAmount >= 500) {
                setWarnUser(true);
                return;
              }

              makeMove(["bet", betAmount]);
              setBetAmount(0);
            }}
            className="betButton"
          >
            PLACE BET!
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * Component that renders the controls for the "Hit" and "Stand" actions during the playing phase.
 *
 * @param userPlayerIndex - The index of the current user player.
 * @param currentPlayer - The index of the player whose turn it is.
 * @param makeMove - The function to call for making a move (e.g., "hit" or "stand").
 * @returns The controls for the player to choose between "Hit" and "Stand".
 */
function PlayControls({
  userPlayerIndex,
  currentPlayer,
  makeMove,
}: {
  userPlayerIndex: number;
  currentPlayer: number;
  makeMove: (move: string) => void;
}) {
  if (userPlayerIndex !== currentPlayer) {
    return <p>Waiting for other players...</p>;
  }

  return (
    <div>
      <button onClick={() => makeMove("hit")} className="resetButton">
        Hit
      </button>
      <button onClick={() => makeMove("stand")} className="betButton">
        Stand
      </button>
    </div>
  );
}

/**
 * Main component for the BlackJack game view.
 *
 * @param view - The current game view including player hands, dealer cards, chips, and the game phase.
 * @param players - List of player objects, containing the display names of the players.
 * @param userPlayerIndex - The index of the current user player in the game.
 * @param makeMove - The function to make a move during the game (such as betting, hitting, or standing).
 * @returns The entire BlackJack game interface with cards, phases, and player actions.
 */
export default function BlackJackGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<BlackJackView, BlackJackMove>) {
  if (view.phase === "choosingRounds") {
    if (userPlayerIndex === 0) {
      return (
        <div className="content spacedSection">
          <h2>Choose number of rounds and decks:</h2>
          <RoundsSelector onSelect={(numRounds, numDecks) => makeMove([numRounds, numDecks])} />
        </div>
      );
    }

    return (
      <div className="content spacedSection">
        <p>Waiting for the host to choose the number of rounds and decks...</p>
      </div>
    );
  }

  if (view.finished && view.phase !== "dealer")
    return (
      <div className="content spacedSection gameWrapper">
        <h2>Game Over!</h2>
        <div>{getWinner(view, players)}</div>
        {view.chips.map((chipValue, index) => (
          <div>
            {players[index].display} finished with... {chipValue} chips.
          </div>
        ))}
      </div>
    );

  return (
    <div className="content spacedSection">
      <div className="gameWrapper">
        <h2>
          Round {view.currRound + 1}/{view.numRounds}: {getPhaseText(view.phase)}
        </h2>

        <div className="dealerHand">
          <div>{view.phase !== "betting" && "Dealer"}</div>
          <div className="cards">
            {view.dealerCards.map((card, index) => (
              <SvgCardView key={index} card={card} />
            ))}
            {view.phase === "playing" && <HoleView />}
          </div>
          {view.phase === "dealer" && (
            <div>
              {evaluateCards(view.dealerCards) <= 21
                ? evaluateCards(view.dealerCards)
                : "Dealer busted!"}
            </div>
          )}
        </div>
        <div className="playersHands">
          {players.map((playerName, index) => (
            <div>
              <PlayerHand
                key={index}
                name={playerName.display}
                cards={view.playerCards[index]}
                chips={view.chips[index]}
                bet={view.bets[index]}
                highlight={index === view.currPlayer}
              />
              {view.phase !== "betting" && (
                <div>{cardsValueToString(evaluateCards(view.playerCards[index]))}</div>
              )}
              {view.phase === "dealer" && (
                <div>
                  {cardsValueToBetState(
                    evaluateCards(view.playerCards[index]),
                    evaluateCards(view.dealerCards),
                    view.bets[index],
                  )}
                </div>
              )}

              {view.currPlayer === userPlayerIndex &&
                index === userPlayerIndex &&
                view.phase === "betting" && (
                  <div className="betWrapper">
                    <BettingControls
                      userPlayerIndex={userPlayerIndex}
                      currentPlayer={view.currPlayer}
                      chips={view.chips}
                      makeMove={makeMove}
                    />
                  </div>
                )}

              {view.currPlayer !== userPlayerIndex &&
                index === userPlayerIndex &&
                view.phase === "betting" && (
                  <div>Waiting for {players[view.currPlayer].display} to bet...</div>
                )}

              {view.currPlayer === userPlayerIndex &&
                index === userPlayerIndex &&
                view.phase === "playing" && (
                  <PlayControls
                    userPlayerIndex={userPlayerIndex}
                    currentPlayer={view.currPlayer}
                    makeMove={makeMove}
                  />
                )}
              {view.currPlayer !== userPlayerIndex &&
                index === userPlayerIndex &&
                view.phase === "playing" && (
                  <div>Waiting for {players[view.currPlayer].display} to play...</div>
                )}
            </div>
          ))}
        </div>
      </div>

      {view.phase === "dealer" && userPlayerIndex === 0 && (
        <button onClick={() => makeMove("nextRound")}>
          {view.finished ? "End Game" : "Next Round"}
        </button>
      )}
      {view.phase === "dealer" && userPlayerIndex !== 0 && (
        <div>
          {view.finished
            ? "Waiting for " + players[0].display + " to end the game..."
            : "Waiting for " + players[0].display + " to start the next round..."}
        </div>
      )}
    </div>
  );
}
