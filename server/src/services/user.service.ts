import { type SafeUserInfo, type UserUpdateRequest } from "@gamenite/shared";
import { getUserByUsername, updateAuth } from "./auth.service.ts";
import { UserRepo } from "../repository.ts";

const disallowedUsernames = new Set(["login", "signup", "list"]);

/**
 * Retrieves a single user from the database.
 *
 * @param userId - Valid user id.
 * @returns the found user object (without the password).
 */
export async function populateSafeUserInfo(userId: string): Promise<SafeUserInfo> {
  const record = await UserRepo.get(userId);
  return Promise.resolve({
    username: record.username,
    display: record.display,
    bio: record.bio,
    pronouns: record.pronouns,
    profilePic: record.profilePic,
    createdAt: new Date(record.createdAt),
  });
}

/**
 * Create and store a new user
 *
 * @param username - The desired username
 * @param password - The plaintext password (omit for Google SSO users)
 * @param createdAt - Account creation timestamp
 * @param display - Optional display name (defaults to username)
 * @returns Resolves with the saved user object (without the password) or an error message.
 */
export async function createUser(
  username: string,
  password: string | undefined,
  createdAt: Date,
  display?: string,
): Promise<SafeUserInfo | { error: string }> {
  if ((await getUserByUsername(username)) !== null) {
    return { error: "User already exists" };
  }
  if (disallowedUsernames.has(username)) {
    return { error: "That is not a permitted username" };
  }
  const resolvedDisplay = display ?? username;
  const id = await UserRepo.add({
    username,
    createdAt: createdAt.toISOString(),
    display: resolvedDisplay,
  });
  await updateAuth(username, password, id);
  return Promise.resolve({
    username,
    createdAt,
    display: resolvedDisplay,
  });
}

/**
 * Retrieves a list of usernames from the database
 *
 * @param usernames - A list of usernames
 * @returns the SafeUserInfo objects corresponding to those users
 * @throws if any of the usernames are not valid
 */
export async function getUsersByUsername(usernames: string[]): Promise<SafeUserInfo[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const user = await getUserByUsername(username);
      if (user === null) {
        throw new Error(`No user ${username}`);
      }
      return populateSafeUserInfo(user.userId);
    }),
  );
}

/**
 * Updates user information in the database
 *
 * @param username - A valid username for the user to update
 * @param updates - An object that defines the fields to be updated and their new values.
 * @returns the updated user object (without the password)
 * @throws if the username does not exist in the database
 */
export async function updateUser(
  username: string,
  { display, bio, pronouns, password, profilePic }: UserUpdateRequest,
): Promise<SafeUserInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);
  if (password !== undefined) await updateAuth(username, password, user.userId);
  const newUser = await UserRepo.get(user.userId);
  if (display !== undefined) newUser.display = display;
  if (bio !== undefined) newUser.bio = bio || undefined; // treat empty as no bio
  if (pronouns !== undefined) newUser.pronouns = pronouns || undefined; // treat empty as no bio
  if (profilePic !== undefined) {
    if (profilePic === "") {
      delete newUser.profilePic;
    } else {
      newUser.profilePic = profilePic;
    }
  }
  await UserRepo.set(user.userId, newUser);
  return populateSafeUserInfo(user.userId);
}
