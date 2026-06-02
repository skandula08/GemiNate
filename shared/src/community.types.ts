import { z } from "zod";
import type { SafeUserInfo } from "./user.types.ts";

export interface CommunityPreview {
  communityId: string;
  name: string;
  memberCount: number;
  members: CommunityUser[];
  description?: string;
  chat: string;
  isPrivate: boolean;
}

/**
 * The possible roles a user can have in a community
 * - `owner`: an admin that can do anything
 * - `dj`: can changee the jukebox queue
 * - `member`: standard community member
 * - `kicked`: was removed from the community but can rejoin
 * - `banned`: permanently removed and cannot rejoin
 */
export type CommunityRole = "owner" | "dj" | "member" | "kicked" | "banned";

export interface CommunityUser {
  user: SafeUserInfo;
  role: CommunityRole;
}

export const zNewCommunityRequest = z.object({
  name: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean(),
});

export type UpdateCommunityRequest = z.infer<typeof zUpdateCommunityRequest>;

export const zUpdateCommunityRequest = z.object({
  communityId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  banner: z.string().optional(),
});

export type SetCommunityRolePayload = z.infer<typeof zSetCommunityRolePayload>;

export const zSetCommunityRolePayload = z.object({
  communityId: z.string(),
  role: z.string(),
  memberUsername: z.string(),
});

export type TransferOwnershipPayload = z.infer<typeof zTransferOwnershipPayload>;

export const zTransferOwnershipPayload = z.object({
  communityId: z.string(),
  memberUsername: z.string(),
});

/** Client-facing view of a pending community invite */
export interface CommunityInvite {
  inviteId: string;
  communityId: string;
  communityName: string;
  inviterUsername: string;
  expiresAt: string;
}

export const zCreateInvitePayload = z.object({
  communityId: z.string(),
  targetUsername: z.string(),
});
export type CreateInvitePayload = z.infer<typeof zCreateInvitePayload>;

export const zInviteActionPayload = z.object({
  inviteId: z.string(),
});
export type InviteActionPayload = z.infer<typeof zInviteActionPayload>;

/** Payload for a member requesting DJ status */
export const zDjRequestPayload = z.object({
  communityId: z.string(),
});
export type DjRequestPayload = z.infer<typeof zDjRequestPayload>;

/** Payload for the owner responding to a DJ request */
export const zDjRequestResponsePayload = z.object({
  communityId: z.string(),
  requesterUsername: z.string(),
  accepted: z.boolean(),
});
export type DjRequestResponsePayload = z.infer<typeof zDjRequestResponsePayload>;

/** A pending DJ request visible to the owner */
export interface DjRequest {
  username: string;
  displayName: string;
}
