import type { UserAuth } from "@gamenite/shared";
import useLoginContext from "./useLoginContext.ts";
import { useMemo } from "react";

/**
 * Custom hook to get authentication information from within a login context.
 * Returns the correct `UserAuth` variant based on whether the user is a
 * password or Google SSO user.
 *
 * @throws if outside a LoginContext
 * @returns a `UserAuth` object that can be sent to the api
 */
export default function useAuth(): UserAuth {
  const context = useLoginContext();
  // This use of `useMemo` is critical, because there are other places in the
  // app where `auth` appears as part of a dependency array (notably most
  // socket-involved hooks that use authentication need `auth` in their
  // dependency array). If we don't use `useMemo` here, those dependency
  // arrays will change whenever the app rerenders and we'll spend all our
  // time connecting and disconnecting sockets until the end of time.
  const auth = useMemo((): UserAuth => {
    if (context.kind === "password") {
      return { kind: "password", username: context.user.username, password: context.pass };
    }
    return { kind: "google", username: context.user.username, sessionToken: context.sessionToken };
  }, [context]);
  return auth;
}
