import { z } from "zod";

/**
 * Represents a "safe" user object that excludes sensitive information like
 * the password, suitable for exposing to clients,
 * - `username`: unique username of the user
 * - `display`: A display name
 * - `bio`: A bio the user can set to show on their profile
 * - `pronouns`: A set of personal pronouns the user can set to show on their profile
 * - `profilePic`: A base64-encoded data URL for the user's profile picture
 * - `createdAt`: when this when the user registered.
 */
export interface SafeUserInfo {
  username: string;
  display: string;
  bio?: string;
  pronouns?: string;
  profilePic?: string;
  createdAt: Date;
}

/*** TYPES USED IN THE USER API ***/

/**
 * Represents allowed updates to a user.
 */
export type UserUpdateRequest = z.infer<typeof zUserUpdateRequest>;
export const zUserUpdateRequest = z.object({
  display: z.string().optional(),
  pronouns: z.string().optional().nullable(),
  bio: z
    .string()
    .nullable()
    .transform((v) => (v === null ? "" : v))
    .optional(),
  password: z.string().optional(),
  profilePic: z.string().optional(),
});
