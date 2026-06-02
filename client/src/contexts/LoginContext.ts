import { type SafeUserInfo } from "@gamenite/shared";
import { createContext } from "react";
import { type GameSocket } from "../util/types.ts";

/**
 * The user information held as part of a login context.
 * A discriminated union — `kind` distinguishes local password users from
 * Google SSO users.
 *
 * - user    - the current user's profile info
 * - reset   - a callback that logs out the user
 *
 * Password variant:
 * - pass    - the user's plaintext password
 *
 * Google SSO variant:
 * - sessionToken - the server-issued session token
 */
export type AuthContext =
  | { kind: "password"; user: SafeUserInfo; pass: string; reset: () => void }
  | { kind: "google"; user: SafeUserInfo; sessionToken: string; reset: () => void };

/**
 * See useLoginContext()
 */
export const LoginContext = createContext<
  | (AuthContext & {
      socket: GameSocket;
    })
  | null
>(null);
