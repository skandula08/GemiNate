import type { GameServer } from "./types.ts";

let ioServer: GameServer | null = null;

export function setIO(io: GameServer): void {
  ioServer = io;
}

export function getIO(): GameServer {
  if (!ioServer) throw new Error("Socket.io server not initialized. Call setIO() first.");
  return ioServer;
}
