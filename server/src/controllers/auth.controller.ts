import type { NextFunction, Request, RequestHandler, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findOrCreateGoogleUser, generateSessionToken } from "../services/auth.service.ts";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? profile.id;
          const displayName = profile.displayName;
          const user = await findOrCreateGoogleUser(profile.id, email, displayName);
          const sessionToken = await generateSessionToken(user.username);
          done(null, { username: user.username, sessionToken });
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

/**
 * Initiates the Google OAuth flow.
 * GET /api/auth/google
 */
export function getGoogleAuth(req: Request, res: Response, next: NextFunction): void {
  (passport.authenticate("google", { scope: ["profile", "email"] }) as RequestHandler)(
    req,
    res,
    next,
  );
}

/**
 * Handles the Google OAuth callback. On success, redirects to the client
 * with a session token and username as query parameters.
 * GET /api/auth/google/callback
 */
export function getGoogleCallback(req: Request, res: Response, next: NextFunction): void {
  const authenticate = passport.authenticate(
    "google",
    { session: false },
    (err: unknown, user: unknown) => {
      if (err || !user) {
        res.redirect(`${CLIENT_URL}/login`);
        return;
      }
      const { username, sessionToken } = user as { username: string; sessionToken: string };
      res.redirect(
        `${CLIENT_URL}/auth/callback?token=${encodeURIComponent(sessionToken)}&username=${encodeURIComponent(username)}`,
      );
    },
  ) as RequestHandler;
  authenticate(req, res, next);
}
