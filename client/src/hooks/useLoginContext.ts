import { useContext } from "react";
import { LoginContext, type AuthContext } from "../contexts/LoginContext.ts";
import type { GameSocket } from "../util/types.ts";

/**
 * Custom hook to access the LoginContext.
 * @throws if outside a LoginContext
 * @returns context information associated with a logged-in user:
 * - `socket`: the Socket.IO connection
 * - `kind`: `"password"` or `"google"` — which auth variant the user used
 * - `user`: the logged-in user's information
 * - `reset`: a callback
 */
export default function useLoginContext(): AuthContext & { socket: GameSocket } {
  const context = useContext(LoginContext);
  if (!context) {
    throw new Error("Login context is null.");
  }

  return context;
}
