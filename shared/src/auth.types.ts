import { z } from "zod";

/**
 * Represents authentication credentials passed with requests.
 * Either a username/password pair (for local accounts) or a
 * username/sessionToken pair (for Google SSO accounts).
 */
export const zUserAuth = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("password"), username: z.string(), password: z.string() }),
  z.object({ kind: z.literal("google"), username: z.string(), sessionToken: z.string() }),
]);

export type UserAuth = z.infer<typeof zUserAuth>;

/**
 * If `zT` is the zod representation of type `T`, then `withAuth(zT)` is the
 * zod representation of the type `WithAuth<T>` that is used to validate
 * payloads of auth-containing client-to-server requests.
 */
export function withAuth<T extends z.ZodType>(zT: T) {
  return z.object({ auth: zUserAuth, payload: zT });
}

/**
 * The type of client-to-server requests containing auth information as well
 * as a data payload.
 */
export interface WithAuth<T> {
  auth: UserAuth;
  payload: T;
}
