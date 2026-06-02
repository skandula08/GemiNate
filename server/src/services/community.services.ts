import type {
  CommunityInvite,
  CommunityPreview,
  DjRequest,
  UpdateCommunityRequest,
} from "@gamenite/shared";
import {
  ChatRepo,
  CommunityRepo,
  InviteTokenRepo,
  UserRepo,
  UserCommunitiesIndex,
  UserInvitesIndex,
  UserLastCommunityIndex,
} from "../repository.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import type { UserWithId } from "../types.ts";
import { getUserByUsername } from "./auth.service.ts";

export const getMyCommunities = async (userId: string): Promise<CommunityPreview[]> => {
  // O(1) index lookup: get this user's community IDs instead of scanning all communities
  const myCommunityIds = (await UserCommunitiesIndex.find(userId)) ?? [];
  if (myCommunityIds.length === 0) return [];

  const myCommunities = await CommunityRepo.getMany(myCommunityIds);

  return await Promise.all(
    myCommunities.map(async (community, index) => ({
      communityId: myCommunityIds[index],
      name: community.name,
      memberCount: community.participants.filter((p) => !["banned", "kicked"].includes(p.role))
        .length,
      members: await Promise.all(
        community.participants
          .filter((p) => !["banned", "kicked"].includes(p.role))
          .map(async (participant) => ({
            user: await populateSafeUserInfo(participant.userId),
            role: participant.role,
          })),
      ),
      description: community.description,
      chat: community.chat,
      isPrivate: community.isPrivate,
    })),
  );
};

export const getCommunityOwnerUsername = async (communityId: string): Promise<string | null> => {
  const community = await CommunityRepo.get(communityId);
  const userId = community.participants.find((participant) => participant.role === "owner")?.userId;
  if (!userId) return null;
  const username = (await UserRepo.get(userId)).username;
  return username;
};

export const getCommunityBanner = async (communityId: string): Promise<string | undefined> => {
  const community = await CommunityRepo.get(communityId);
  const banner = community.backgroundImage;
  return banner;
};

export const getJoinableCommunities = async (userId: string) => {
  // We still need to scan all communities for joinable ones because
  // joinable = communities the user is NOT in (or kicked from) AND not private.
  // However, we can use the user's index to quickly filter.
  const myCommunityIds = new Set((await UserCommunitiesIndex.find(userId)) ?? []);
  const allCommunityKeys = await CommunityRepo.getAllKeys();

  // Only fetch communities the user is NOT already an active member of
  const candidateKeys = allCommunityKeys.filter((key) => !myCommunityIds.has(key));
  if (candidateKeys.length === 0) return [];

  const candidates = await CommunityRepo.getMany(candidateKeys);

  const joinableCommunities = candidates
    .map((community, index) => ({
      communityId: candidateKeys[index],
      ...community,
    }))
    .filter((community) => {
      const participant = community.participants.find((p) => p.userId === userId);
      return (!participant || participant.role === "kicked") && !community.isPrivate;
    });

  return await Promise.all(
    joinableCommunities.map(async (community) => ({
      communityId: community.communityId,
      name: community.name,
      memberCount: community.participants.filter((p) => !["banned", "kicked"].includes(p.role))
        .length,
      members: await Promise.all(
        community.participants
          .filter((p) => !["banned", "kicked"].includes(p.role))
          .map(async (participant) => ({
            user: await populateSafeUserInfo(participant.userId),
            role: participant.role,
          })),
      ),
      description: community.description,
      chat: community.chat,
      isPrivate: community.isPrivate,
    })),
  );
};

export const createCommunity = async (
  creatorId: string,
  name: string,
  isPrivate: boolean,
  description?: string,
) => {
  // O(1) rate-limit check via index instead of scanning all communities
  const lastCreated = await UserLastCommunityIndex.find(creatorId);
  if (lastCreated) {
    if (new Date().toLocaleDateString() === new Date(lastCreated.createdAt).toLocaleDateString()) {
      throw new Error(
        "You already created a community today. Please wait until tomorrow to create another one.",
      );
    }
  }

  const chatId = await ChatRepo.add({
    messages: [],
    createdAt: new Date().toISOString(),
    moveLog: [],
  });

  const createdAt = new Date().toISOString();
  const communityId = await CommunityRepo.add({
    name,
    description,
    isPrivate,
    participants: [{ userId: creatorId, role: "owner" }],
    djRequests: [],
    chat: chatId,
    createdAt,
    createdBy: creatorId,
  });

  // Maintain indexes: add community to creator's list and update last-created
  const existingCommunities = (await UserCommunitiesIndex.find(creatorId)) ?? [];
  await UserCommunitiesIndex.set(creatorId, [...existingCommunities, communityId]);
  await UserLastCommunityIndex.set(creatorId, { communityId, createdAt });

  return communityId;
};

export const joinCommunity = async (communityId: string, user: UserWithId) => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error(`user ${user.username} joining invalid community`);

  if (community.isPrivate) {
    throw new Error("This community is private. You must be invited to join.");
  }

  let resetKicked = false;
  if (community.participants.some((participant) => participant.userId === user.userId)) {
    const kicked = community.participants.find(
      (participant) => participant.userId === user.userId && participant.role === "kicked",
    );
    if (kicked !== undefined) {
      resetKicked = true;
      kicked.role = "member";
    } else throw new Error(`user ${user.username} joining community they are in already`);
  }

  if (!resetKicked)
    community.participants = [...community.participants, { userId: user.userId, role: "member" }];
  await CommunityRepo.set(communityId, community);

  // Maintain index: add community to user's list
  const existingCommunities = (await UserCommunitiesIndex.find(user.userId)) ?? [];
  if (!existingCommunities.includes(communityId)) {
    await UserCommunitiesIndex.set(user.userId, [...existingCommunities, communityId]);
  }

  return community;
};

export const getCommunity = async (communityId: string) => {
  const community = await CommunityRepo.find(communityId);

  if (!community) throw new Error("Community does not exist.");

  return community;
};

export const editCommunity = async (
  user: UserWithId,
  { communityId, name, description, banner }: UpdateCommunityRequest,
) => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  const currentOwner = community.participants.find((p) => p.role === "owner");
  if (!currentOwner || currentOwner.userId !== user.userId) {
    throw new Error("Only owner can edit community");
  }

  if (name !== undefined) community.name = name;
  if (description !== undefined) community.description = description || undefined; // treat empty as no bio
  if (banner !== undefined) {
    if (banner === "") {
      delete community.backgroundImage;
    } else {
      community.backgroundImage = banner;
    }
  }

  await CommunityRepo.set(communityId, community);

  return communityId;
};

export const setCommunityRole = async (
  communityId: string,
  user: UserWithId,
  targetMemberUsername: string,
  role: string,
) => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  const actingParticipant = community.participants.find((p) => p.userId === user.userId);
  if (!actingParticipant || actingParticipant.role !== "owner") {
    throw new Error("Only owner can modify roles");
  }

  const targetUser = await getUserByUsername(targetMemberUsername);
  if (!targetUser) throw new Error("Target user not found");

  const targetParticipant = community.participants.find((p) => p.userId === targetUser.userId);
  if (!targetParticipant) {
    throw new Error("Target user is not in community");
  }

  if (targetParticipant.role === "owner") {
    throw new Error("Cannot modify owner role");
  }

  const oldRole = targetParticipant.role;
  if (role === "member" || role === "dj" || role === "kicked" || role === "banned")
    targetParticipant.role = role;
  else throw new Error("Invalid Role!");

  await CommunityRepo.set(communityId, community);

  // Maintain index: if user was active and is now kicked/banned, remove community from their index
  const wasActive = oldRole !== "banned" && oldRole !== "kicked";
  const isActive = role !== "banned" && role !== "kicked";
  if (wasActive && !isActive) {
    const existingCommunities = (await UserCommunitiesIndex.find(targetUser.userId)) ?? [];
    await UserCommunitiesIndex.set(
      targetUser.userId,
      existingCommunities.filter((id) => id !== communityId),
    );
  } else if (!wasActive && isActive) {
    const existingCommunities = (await UserCommunitiesIndex.find(targetUser.userId)) ?? [];
    if (!existingCommunities.includes(communityId)) {
      await UserCommunitiesIndex.set(targetUser.userId, [...existingCommunities, communityId]);
    }
  }

  return community;
};

export const createInvite = async (
  actingUserId: string,
  communityId: string,
  targetUsername: string,
): Promise<string> => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");
  if (!community.isPrivate) throw new Error("Only private communities require invites");

  const actor = community.participants.find((p) => p.userId === actingUserId);
  if (!actor || actor.role !== "owner")
    throw new Error("Only the community owner can invite users");

  const targetUser = await getUserByUsername(targetUsername);
  if (!targetUser) throw new Error(`User "${targetUsername}" not found`);

  const existing = community.participants.find((p) => p.userId === targetUser.userId);
  if (existing && !["kicked"].includes(existing.role)) {
    if (existing.role === "banned") throw new Error("Cannot invite a banned user");
    throw new Error(`${targetUsername} is already a member of this community`);
  }

  // Check for an existing non-expired invite using the index
  const userInviteIds = (await UserInvitesIndex.find(targetUser.userId)) ?? [];
  if (userInviteIds.length > 0) {
    const now = new Date();
    const userInvites = await InviteTokenRepo.getMany(userInviteIds);
    const duplicate = userInvites.find(
      (inv) => inv.communityId === communityId && new Date(inv.expiresAt) > now,
    );
    if (duplicate)
      throw new Error(`${targetUsername} already has a pending invite to this community`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteId = await InviteTokenRepo.add({
    communityId,
    targetUserId: targetUser.userId,
    createdBy: actingUserId,
    createdAt: now.toISOString(),
    expiresAt,
  });

  // Maintain index: add invite to target user's list
  await UserInvitesIndex.set(targetUser.userId, [...userInviteIds, inviteId]);

  return inviteId;
};

export const getMyPendingInvites = async (userId: string): Promise<CommunityInvite[]> => {
  // O(1) index lookup instead of scanning all invites
  const inviteIds = (await UserInvitesIndex.find(userId)) ?? [];
  if (inviteIds.length === 0) return [];

  const invites = await InviteTokenRepo.getMany(inviteIds);
  const now = new Date();

  // Filter to only pending (non-expired) invites and clean up the index
  const pendingEntries: { inviteId: string; inv: (typeof invites)[number] }[] = [];
  const stillValidIds: string[] = [];
  invites.forEach((inv, i) => {
    if (new Date(inv.expiresAt) > now) {
      pendingEntries.push({ inviteId: inviteIds[i], inv });
      stillValidIds.push(inviteIds[i]);
    }
  });

  // Update the index to remove expired invites
  if (stillValidIds.length !== inviteIds.length) {
    await UserInvitesIndex.set(userId, stillValidIds);
  }

  return await Promise.all(
    pendingEntries.map(async ({ inviteId, inv }) => {
      const community = await CommunityRepo.find(inv.communityId);
      const inviter = await UserRepo.find(inv.createdBy);
      return {
        inviteId,
        communityId: inv.communityId,
        communityName: community?.name ?? "(deleted community)",
        inviterUsername: inviter?.username ?? "(unknown)",
        expiresAt: inv.expiresAt,
      };
    }),
  );
};

export const acceptInvite = async (inviteId: string, userId: string): Promise<void> => {
  const invite = await InviteTokenRepo.find(inviteId);
  if (!invite) throw new Error("Invite not found");
  if (invite.targetUserId !== userId) throw new Error("This invite is not for you");
  if (new Date(invite.expiresAt) <= new Date()) throw new Error("This invite has expired");

  const community = await CommunityRepo.find(invite.communityId);
  if (!community) throw new Error("Community no longer exists");

  const existing = community.participants.find((p) => p.userId === userId);
  if (existing) {
    if (existing.role === "banned") throw new Error("You are banned from this community");
    if (existing.role !== "kicked") throw new Error("You are already a member");
    existing.role = "member";
  } else {
    community.participants.push({ userId, role: "member" });
  }

  await CommunityRepo.set(invite.communityId, community);
  // Expire the invite by back-dating it so it won't appear again
  await InviteTokenRepo.set(inviteId, { ...invite, expiresAt: new Date(0).toISOString() });

  // Maintain indexes: add community to user's list, remove invite from user's list
  const existingCommunities = (await UserCommunitiesIndex.find(userId)) ?? [];
  if (!existingCommunities.includes(invite.communityId)) {
    await UserCommunitiesIndex.set(userId, [...existingCommunities, invite.communityId]);
  }
  const existingInvites = (await UserInvitesIndex.find(userId)) ?? [];
  await UserInvitesIndex.set(
    userId,
    existingInvites.filter((id) => id !== inviteId),
  );
};

export const declineInvite = async (inviteId: string, userId: string): Promise<void> => {
  const invite = await InviteTokenRepo.find(inviteId);
  if (!invite) throw new Error("Invite not found");
  if (invite.targetUserId !== userId) throw new Error("This invite is not for you");

  await InviteTokenRepo.set(inviteId, { ...invite, expiresAt: new Date(0).toISOString() });

  // Maintain index: remove invite from user's list
  const existingInvites = (await UserInvitesIndex.find(userId)) ?? [];
  await UserInvitesIndex.set(
    userId,
    existingInvites.filter((id) => id !== inviteId),
  );
};

export const transferCommunityOwnership = async (
  communityId: string,
  user: UserWithId,
  targetMemberUsername: string,
) => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  const currentOwner = community.participants.find((p) => p.role === "owner");
  if (!currentOwner || currentOwner.userId !== user.userId) {
    throw new Error("Only owner can transfer ownership");
  }

  const targetUser = await getUserByUsername(targetMemberUsername);
  if (!targetUser) throw new Error("Target user not found");

  const targetParticipant = community.participants.find((p) => p.userId === targetUser.userId);
  if (!targetParticipant) {
    throw new Error("Target user is not in community");
  }

  if (["banned", "kicked"].includes(targetParticipant.role)) {
    throw new Error("Cannot transfer ownership to banned/kicked user");
  }

  currentOwner.role = "member";
  targetParticipant.role = "owner";

  await CommunityRepo.set(communityId, community);

  return community;
};

/** Submit a DJ request on behalf of a member */
export const requestDj = async (communityId: string, user: UserWithId): Promise<DjRequest[]> => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  const participant = community.participants.find((p) => p.userId === user.userId);
  if (!participant) throw new Error("You are not a member of this community");
  if (participant.role === "owner" || participant.role === "dj") {
    throw new Error("You already have DJ permissions");
  }
  if (participant.role === "kicked" || participant.role === "banned") {
    throw new Error("You are not an active member of this community");
  }

  // Ensure djRequests array exists (for older community records)
  if (!community.djRequests) community.djRequests = [];

  if (community.djRequests.includes(user.userId)) {
    throw new Error("You already have a pending DJ request");
  }

  community.djRequests.push(user.userId);
  await CommunityRepo.set(communityId, community);

  return getDjRequestList(community.djRequests);
};

/** Respond to a DJ request (owner only) */
export const respondToDjRequest = async (
  communityId: string,
  owner: UserWithId,
  requesterUsername: string,
  accepted: boolean,
) => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  const actingParticipant = community.participants.find((p) => p.userId === owner.userId);
  if (!actingParticipant || actingParticipant.role !== "owner") {
    throw new Error("Only the owner can respond to DJ requests");
  }

  const requesterUser = await getUserByUsername(requesterUsername);
  if (!requesterUser) throw new Error("Requester user not found");

  // Ensure djRequests array exists
  if (!community.djRequests) community.djRequests = [];

  const requestIndex = community.djRequests.indexOf(requesterUser.userId);
  if (requestIndex === -1) {
    throw new Error("No pending DJ request from this user");
  }

  // Remove the request
  community.djRequests.splice(requestIndex, 1);

  // If accepted, promote to DJ
  if (accepted) {
    const requesterParticipant = community.participants.find(
      (p) => p.userId === requesterUser.userId,
    );
    if (requesterParticipant && requesterParticipant.role === "member") {
      requesterParticipant.role = "dj";
    }
  }

  await CommunityRepo.set(communityId, community);

  return {
    community,
    djRequests: await getDjRequestList(community.djRequests),
    requesterUserId: requesterUser.userId,
  };
};

/** Get the current list of pending DJ requests for a community */
export const getDjRequests = async (communityId: string): Promise<DjRequest[]> => {
  const community = await CommunityRepo.find(communityId);
  if (!community) throw new Error("Community not found");

  if (!community.djRequests) return [];

  return getDjRequestList(community.djRequests);
};

/** Helper: convert userId array to DjRequest array */
async function getDjRequestList(userIds: string[]): Promise<DjRequest[]> {
  const results: DjRequest[] = [];
  for (const userId of userIds) {
    const userRecord = await UserRepo.find(userId);
    if (userRecord) {
      results.push({
        username: userRecord.username,
        displayName: userRecord.display,
      });
    }
  }
  return results;
}
