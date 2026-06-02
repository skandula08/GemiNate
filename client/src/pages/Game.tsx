import "./Game.css";
import { useParams } from "react-router-dom";
import { getGameById } from "../services/gameService.ts";
import { useEffect, useState } from "react";
import type { GameInfo } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel.tsx";
import GamePanel from "../components/GamePanel.tsx";

export default function Game() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // non-nullish assertion is ok here given that Game is only called in a
      // route with `:gameId`
      const game = await getGameById(gameId!);
      if (ignore || "error" in game) return;
      setGame(game);
    })();
    return () => {
      ignore = true;
    };
  }, [gameId]);

  return (
    game && (
      <>
        <div className="gameContainer">
          <GamePanel {...game} />
          <ChatPanel chatId={game.chat} />
        </div>
      </>
    )
  );
}
