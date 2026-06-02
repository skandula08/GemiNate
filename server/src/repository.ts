import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
  CommunityRecord,
  GameRecord,
  InviteTokenRecord,
  MessageRecord,
  PlaylistRecord,
  ThreadRecord,
  UserRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const CommunityRepo = createRepo<CommunityRecord>("community");
export const GameRepo = createRepo<GameRecord>("game");
export const InviteTokenRepo = createRepo<InviteTokenRecord>("inviteToken");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
export const PlaylistRepo = createRepo<PlaylistRecord>("playlist");

// ── Secondary indexes ────────────────────────────────────────────────
// These repos map a lookup field to the primary key(s) so that queries
// no longer require a full table scan.

/** communityId  →  playlistId  (1-to-1) */
export const PlaylistByCommunityIndex = createRepo<string>("idx_playlist_by_community");

/** googleId  →  username  (1-to-1) */
export const GoogleIdToUsernameIndex = createRepo<string>("idx_google_to_username");

/** userId  →  communityId[]  (1-to-many) – communities where the user is an active participant */
export const UserCommunitiesIndex = createRepo<string[]>("idx_user_communities");

/** userId  →  inviteTokenId[]  (1-to-many) – pending invite token ids for a user */
export const UserInvitesIndex = createRepo<string[]>("idx_user_invites");

/** creatorId  →  { communityId, createdAt }  (latest community created by a user) */
export const UserLastCommunityIndex = createRepo<{ communityId: string; createdAt: string }>(
  "idx_user_last_community",
);
