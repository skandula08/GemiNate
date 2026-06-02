import { randomUUID } from "node:crypto";
import { AuthRepo, GoogleIdToUsernameIndex } from "../repository.ts";
import type { UserWithId } from "../types.ts";
import type { UserAuth } from "@gamenite/shared";

/**
 * Retrieves a single user from the database.
 *
 * @param username - The username of the user to find
 * @returns the found user object (without the password) or null
 */
export async function getUserByUsername(username: string): Promise<UserWithId | null> {
  const auth = await AuthRepo.find(username);
  if (!auth) return null;
  return Promise.resolve({ userId: auth.userId, username });
}

/**
 * Create or update the authentication information associated with a specific
 * username. For Google SSO users, `password` is omitted.
 *
 * @param username
 * @param password - The plaintext password (omit for Google SSO users)
 * @param userId the User model connected to this username
 */
export async function updateAuth(username: string, password: string | undefined, userId: string) {
  const existing = await AuthRepo.find(username);
  await AuthRepo.set(username, { ...(existing ?? {}), password, userId });
}

/**
 * Takes auth credentials and either returns the corresponding user object
 * (without the password) or null if the credentials do not match stored values.
 * Dispatches on `auth.kind` to support both password and Google SSO users.
 *
 * @param auth - A user's authentication information
 * @returns the corresponding user object (without the password) or null.
 */
export async function checkAuth(auth: UserAuth): Promise<UserWithId | null> {
  const record = await AuthRepo.find(auth.username);
  if (!record) return null;

  if (auth.kind === "password") {
    if (!record.password || auth.password !== record.password) return null;
  } else {
    if (!record.sessionToken || auth.sessionToken !== record.sessionToken) return null;
  }

  return { username: auth.username, userId: record.userId };
}

/**
 * Takes auth credentials and returns the corresponding user, or throws if
 * the credentials are invalid.
 *
 * @param auth - A user's authentication information
 * @returns the corresponding user object (without the password)
 * @throws if the auth information is incorrect
 */
export async function enforceAuth(auth: UserAuth): Promise<UserWithId> {
  const user = await checkAuth(auth);
  if (!user) throw new Error("Invalid auth");
  return user;
}

/**
 * Finds an existing user by Google ID, or creates a new one if none exists.
 *
 * @param googleId - The Google OAuth `sub` claim
 * @param email - The user's Google email address
 * @param displayName - The user's Google display name
 * @returns the username and userId of the found or created user
 */
export async function findOrCreateGoogleUser(
  googleId: string,
  email: string,
  displayName: string,
): Promise<UserWithId> {
  // O(1) lookup via the secondary index instead of scanning all auth records
  const existingUsername = await GoogleIdToUsernameIndex.find(googleId);
  if (existingUsername) {
    const record = await AuthRepo.get(existingUsername);
    return { username: existingUsername, userId: record.userId };
  }

  // No existing user — create one. Derive username from email local part,
  // falling back to a UUID suffix to avoid collisions.
  const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
  let username = baseUsername;
  if (await AuthRepo.find(username)) {
    username = `${baseUsername}_${randomUUID().slice(0, 8)}`;
  }

  // Import here to avoid circular dependency (auth.service ↔ user.service)
  const { createUser } = await import("./user.service.ts");
  const result = await createUser(username, undefined, new Date(), displayName);
  if ("error" in result) {
    throw new Error(`Failed to create Google user: ${result.error}`);
  }

  const record = await AuthRepo.find(username);
  if (!record) throw new Error("Auth record missing after user creation");

  // Attach the googleId to the auth record and update the index
  await AuthRepo.set(username, { ...record, googleId });
  await GoogleIdToUsernameIndex.set(googleId, username);

  return { username, userId: record.userId };
}

/**
 * Generates and stores a new session token for a Google SSO user.
 *
 * @param username - The username of the Google SSO user
 * @returns the new session token
 */
export async function generateSessionToken(username: string): Promise<string> {
  const record = await AuthRepo.find(username);
  if (!record) throw new Error(`No auth record for ${username}`);
  const sessionToken = randomUUID();
  await AuthRepo.set(username, { ...record, sessionToken });
  return sessionToken;
}
