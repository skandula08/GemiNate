/* eslint no-console: "off" */
import {
  AuthRepo,
  CommunityRepo,
  PlaylistRepo,
  InviteTokenRepo,
  PlaylistByCommunityIndex,
  GoogleIdToUsernameIndex,
  UserCommunitiesIndex,
  UserInvitesIndex,
  UserLastCommunityIndex,
} from "./repository.ts";

/**
 * Rebuilds every secondary index from the primary data stores.
 * Intended to run once at server startup after the DB initializer is set.
 */
export async function rebuildIndexes(): Promise<void> {
  const start = Date.now();
  console.log("[rebuildIndexes] Starting full index rebuild…");

  try {
    // ── 0. Clear all indexes ───────────────────────────────────────────
    await Promise.all([
      PlaylistByCommunityIndex.clear(),
      GoogleIdToUsernameIndex.clear(),
      UserCommunitiesIndex.clear(),
      UserInvitesIndex.clear(),
      UserLastCommunityIndex.clear(),
    ]);

    // ── 1. PlaylistByCommunityIndex ────────────────────────────────────
    try {
      const playlistKeys = await PlaylistRepo.getAllKeys();
      if (playlistKeys.length > 0) {
        const playlists = await PlaylistRepo.getMany(playlistKeys);
        await Promise.all(
          playlists.map((playlist, i) =>
            PlaylistByCommunityIndex.set(playlist.communityId, playlistKeys[i]),
          ),
        );
      }
      console.log(`[rebuildIndexes]   PlaylistByCommunityIndex: done`);
    } catch (err) {
      console.error("[rebuildIndexes]   PlaylistByCommunityIndex failed:", err);
    }

    // ── 2. GoogleIdToUsernameIndex ─────────────────────────────────────
    try {
      const authKeys = await AuthRepo.getAllKeys(); // keys ARE usernames
      if (authKeys.length > 0) {
        const authRecords = await AuthRepo.getMany(authKeys);
        await Promise.all(
          authRecords.map((record, i) => {
            if (record.googleId) {
              return GoogleIdToUsernameIndex.set(record.googleId, authKeys[i]);
            }
            return Promise.resolve();
          }),
        );
      }
      console.log(`[rebuildIndexes]   GoogleIdToUsernameIndex: done`);
    } catch (err) {
      console.error("[rebuildIndexes]   GoogleIdToUsernameIndex failed:", err);
    }

    // ── 3. UserCommunitiesIndex ────────────────────────────────────────
    try {
      const communityKeys = await CommunityRepo.getAllKeys();
      if (communityKeys.length > 0) {
        const communities = await CommunityRepo.getMany(communityKeys);
        const userCommunities = new Map<string, string[]>();

        communities.forEach((community, i) => {
          const communityId = communityKeys[i];
          for (const participant of community.participants) {
            if (participant.role !== "banned" && participant.role !== "kicked") {
              const list = userCommunities.get(participant.userId) ?? [];
              list.push(communityId);
              userCommunities.set(participant.userId, list);
            }
          }
        });

        await Promise.all(
          Array.from(userCommunities.entries()).map(([userId, communityIds]) =>
            UserCommunitiesIndex.set(userId, communityIds),
          ),
        );
      }
      console.log(`[rebuildIndexes]   UserCommunitiesIndex: done`);
    } catch (err) {
      console.error("[rebuildIndexes]   UserCommunitiesIndex failed:", err);
    }

    // ── 4. UserInvitesIndex ────────────────────────────────────────────
    try {
      const inviteKeys = await InviteTokenRepo.getAllKeys();
      if (inviteKeys.length > 0) {
        const invites = await InviteTokenRepo.getMany(inviteKeys);
        const now = new Date();
        const userInvites = new Map<string, string[]>();

        invites.forEach((invite, i) => {
          if (new Date(invite.expiresAt) > now) {
            const list = userInvites.get(invite.targetUserId) ?? [];
            list.push(inviteKeys[i]);
            userInvites.set(invite.targetUserId, list);
          }
        });

        await Promise.all(
          Array.from(userInvites.entries()).map(([userId, inviteIds]) =>
            UserInvitesIndex.set(userId, inviteIds),
          ),
        );
      }
      console.log(`[rebuildIndexes]   UserInvitesIndex: done`);
    } catch (err) {
      console.error("[rebuildIndexes]   UserInvitesIndex failed:", err);
    }

    // ── 5. UserLastCommunityIndex ──────────────────────────────────────
    try {
      const communityKeys = await CommunityRepo.getAllKeys();
      if (communityKeys.length > 0) {
        const communities = await CommunityRepo.getMany(communityKeys);
        const latestByUser = new Map<string, { communityId: string; createdAt: string }>();

        communities.forEach((community, i) => {
          const communityId = communityKeys[i];
          const existing = latestByUser.get(community.createdBy);
          if (!existing || new Date(community.createdAt) > new Date(existing.createdAt)) {
            latestByUser.set(community.createdBy, {
              communityId,
              createdAt: community.createdAt,
            });
          }
        });

        await Promise.all(
          Array.from(latestByUser.entries()).map(([userId, entry]) =>
            UserLastCommunityIndex.set(userId, entry),
          ),
        );
      }
      console.log(`[rebuildIndexes]   UserLastCommunityIndex: done`);
    } catch (err) {
      console.error("[rebuildIndexes]   UserLastCommunityIndex failed:", err);
    }
  } catch (err) {
    console.error("[rebuildIndexes] Fatal error during index rebuild:", err);
  }

  const elapsed = Date.now() - start;
  console.log(`[rebuildIndexes] Completed in ${elapsed}ms`);
}
