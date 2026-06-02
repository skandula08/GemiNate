import { describe, expect, it } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import {
  createCommunity,
  getMyCommunities,
  getJoinableCommunities,
  getCommunityOwnerUsername,
  getCommunityBanner,
  joinCommunity,
  getCommunity,
  editCommunity,
  setCommunityRole,
  transferCommunityOwnership,
  createInvite,
  getMyPendingInvites,
  acceptInvite,
  declineInvite,
  requestDj,
  respondToDjRequest,
  getDjRequests,
} from "../../src/services/community.services.ts";
import { CommunityRepo, InviteTokenRepo } from "../../src/repository.ts";
import type { UserWithId } from "../../src/types.ts";

// Helper to get seeded users (seeded in setup.ts via resetEverythingToDefaults)
async function getUser(username: string): Promise<UserWithId> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`seeded user ${username} not found`);
  return user;
}

// ---------------------------------------------------------------------------
// createCommunity
// ---------------------------------------------------------------------------
describe("createCommunity", () => {
  it("creates a public community and returns its id", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "TestCommunity", false);
    expect(communityId).toEqual(expect.any(String));

    const community = await CommunityRepo.get(communityId);
    expect(community.name).toBe("TestCommunity");
    expect(community.isPrivate).toBe(false);
    expect(community.description).toBeUndefined();
    expect(community.createdBy).toBe(user0.userId);
    expect(community.participants).toEqual([{ userId: user0.userId, role: "owner" }]);
    expect(community.djRequests).toEqual([]);
  });

  it("creates a private community with a description", async () => {
    const user1 = await getUser("user1");
    const communityId = await createCommunity(user1.userId, "SecretClub", true, "A secret club");
    const community = await CommunityRepo.get(communityId);
    expect(community.isPrivate).toBe(true);
    expect(community.description).toBe("A secret club");
  });

  it("throws if the user already created a community today", async () => {
    const user2 = await getUser("user2");
    await createCommunity(user2.userId, "First", false);

    await expect(createCommunity(user2.userId, "Second", false)).rejects.toThrow(
      "You already created a community today",
    );
  });

  it("different users can each create a community on the same day", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const id0 = await createCommunity(user0.userId, "Community0", false);
    const id1 = await createCommunity(user1.userId, "Community1", false);

    expect(id0).toEqual(expect.any(String));
    expect(id1).toEqual(expect.any(String));
    expect(id0).not.toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// getCommunity
// ---------------------------------------------------------------------------
describe("getCommunity", () => {
  it("returns the community record for a valid id", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "TestC", false);
    const community = await getCommunity(communityId);
    expect(community.name).toBe("TestC");
    expect(community.participants.length).toBe(1);
  });

  it("throws for a non-existent community", async () => {
    await expect(getCommunity("nonexistent-id")).rejects.toThrow("Community does not exist.");
  });
});

// ---------------------------------------------------------------------------
// getMyCommunities
// ---------------------------------------------------------------------------
describe("getMyCommunities", () => {
  it("returns communities where the user is an active member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    await createCommunity(user0.userId, "OwnerCommunity", false);
    const joinableId = await createCommunity(user1.userId, "JoinableCommunity", false);
    await joinCommunity(joinableId, user0);

    const myCommunities = await getMyCommunities(user0.userId);
    const names = myCommunities.map((c) => c.name);
    expect(names).toContain("OwnerCommunity");
    expect(names).toContain("JoinableCommunity");
    expect(myCommunities.length).toBe(2);
  });

  it("returns an empty array when user is in no communities", async () => {
    const user3 = await getUser("user3");
    const result = await getMyCommunities(user3.userId);
    expect(result).toEqual([]);
  });

  it("excludes communities where user is banned", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BanTest", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "banned");

    const myCommunities = await getMyCommunities(user1.userId);
    expect(myCommunities.map((c) => c.name)).not.toContain("BanTest");
  });

  it("excludes communities where user is kicked", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickTest", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    const myCommunities = await getMyCommunities(user1.userId);
    expect(myCommunities.map((c) => c.name)).not.toContain("KickTest");
  });

  it("returns correct memberCount (excluding banned/kicked)", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "CountTest", false);
    await joinCommunity(communityId, user1);
    await joinCommunity(communityId, user2);
    await setCommunityRole(communityId, user0, "user2", "kicked");

    const myCommunities = await getMyCommunities(user0.userId);
    const community = myCommunities.find((c) => c.name === "CountTest");
    expect(community).toBeDefined();
    expect(community!.memberCount).toBe(2); // user0 (owner) + user1 (member), not user2 (kicked)
  });
});

// ---------------------------------------------------------------------------
// getJoinableCommunities
// ---------------------------------------------------------------------------
describe("getJoinableCommunities", () => {
  it("returns public communities the user is not in", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    await createCommunity(user0.userId, "PublicOne", false);
    const joinable = await getJoinableCommunities(user1.userId);
    expect(joinable.map((c) => c.name)).toContain("PublicOne");
  });

  it("excludes private communities", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    await createCommunity(user0.userId, "PrivateOne", true);
    const joinable = await getJoinableCommunities(user1.userId);
    expect(joinable.map((c) => c.name)).not.toContain("PrivateOne");
  });

  it("excludes communities the user is already a member of", async () => {
    const user0 = await getUser("user0");
    const _joinable = await getJoinableCommunities(user0.userId);
    // user0 is owner of any community they created, so it shouldn't be joinable
    await createCommunity(user0.userId, "MyOwn", false);
    const joinable2 = await getJoinableCommunities(user0.userId);
    expect(joinable2.map((c) => c.name)).not.toContain("MyOwn");
  });

  it("includes communities where the user was kicked (re-joinable)", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickedReJoin", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    const joinable = await getJoinableCommunities(user1.userId);
    expect(joinable.map((c) => c.name)).toContain("KickedReJoin");
  });

  it("excludes communities where the user is banned", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BannedNoJoin", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "banned");

    const joinable = await getJoinableCommunities(user1.userId);
    expect(joinable.map((c) => c.name)).not.toContain("BannedNoJoin");
  });
});

// ---------------------------------------------------------------------------
// getCommunityOwnerUsername
// ---------------------------------------------------------------------------
describe("getCommunityOwnerUsername", () => {
  it("returns the owner username", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "OwnerTest", false);
    const ownerUsername = await getCommunityOwnerUsername(communityId);
    expect(ownerUsername).toBe("user0");
  });

  it("returns null when there is no owner (edge case)", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "NoOwnerTest", false);

    // Manually remove the owner participant to simulate edge case
    const community = await CommunityRepo.get(communityId);
    community.participants = community.participants.filter((p) => p.role !== "owner");
    await CommunityRepo.set(communityId, community);

    const ownerUsername = await getCommunityOwnerUsername(communityId);
    expect(ownerUsername).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCommunityBanner
// ---------------------------------------------------------------------------
describe("getCommunityBanner", () => {
  it("returns undefined when no banner is set", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "NoBanner", false);
    const banner = await getCommunityBanner(communityId);
    expect(banner).toBeUndefined();
  });

  it("returns the banner after one is set", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "BannerTest", false);
    await editCommunity(user0, { communityId, name: "BannerTest", banner: "http://img.png" });
    const banner = await getCommunityBanner(communityId);
    expect(banner).toBe("http://img.png");
  });
});

// ---------------------------------------------------------------------------
// joinCommunity
// ---------------------------------------------------------------------------
describe("joinCommunity", () => {
  it("adds a user to a public community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "JoinTest", false);
    const result = await joinCommunity(communityId, user1);

    expect(result.participants).toEqual(
      expect.arrayContaining([
        { userId: user0.userId, role: "owner" },
        { userId: user1.userId, role: "member" },
      ]),
    );
  });

  it("throws when joining a private community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "PrivJoin", true);
    await expect(joinCommunity(communityId, user1)).rejects.toThrow(
      "This community is private. You must be invited to join.",
    );
  });

  it("throws when the user is already a member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DupJoin", false);
    await joinCommunity(communityId, user1);
    await expect(joinCommunity(communityId, user1)).rejects.toThrow(
      "joining community they are in already",
    );
  });

  it("allows a kicked user to rejoin", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "ReJoinKick", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    const result = await joinCommunity(communityId, user1);
    const user1Participant = result.participants.find((p) => p.userId === user1.userId);
    expect(user1Participant).toBeDefined();
    expect(user1Participant!.role).toBe("member");
  });

  it("throws for an invalid (non-existent) community", async () => {
    const user1 = await getUser("user1");
    await expect(joinCommunity("nonexistent-id", user1)).rejects.toThrow(
      "joining invalid community",
    );
  });
});

// ---------------------------------------------------------------------------
// editCommunity
// ---------------------------------------------------------------------------
describe("editCommunity", () => {
  it("allows owner to update name and description", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "EditTest", false, "Old desc");
    await editCommunity(user0, { communityId, name: "NewName", description: "New desc" });

    const community = await CommunityRepo.get(communityId);
    expect(community.name).toBe("NewName");
    expect(community.description).toBe("New desc");
  });

  it("allows owner to set and clear a banner", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "BannerEdit", false);

    await editCommunity(user0, { communityId, name: "BannerEdit", banner: "http://banner.jpg" });
    let community = await CommunityRepo.get(communityId);
    expect(community.backgroundImage).toBe("http://banner.jpg");

    // Clear banner
    await editCommunity(user0, { communityId, name: "BannerEdit", banner: "" });
    community = await CommunityRepo.get(communityId);
    expect(community.backgroundImage).toBeUndefined();
  });

  it("treats empty description as undefined", async () => {
    const user0 = await getUser("user0");
    const communityId = await createCommunity(user0.userId, "DescClear", false, "Some desc");
    await editCommunity(user0, { communityId, name: "DescClear", description: "" });

    const community = await CommunityRepo.get(communityId);
    expect(community.description).toBeUndefined();
  });

  it("throws when a non-owner tries to edit", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "NoEdit", false);
    await joinCommunity(communityId, user1);

    await expect(editCommunity(user1, { communityId, name: "Hacked" })).rejects.toThrow(
      "Only owner can edit community",
    );
  });

  it("throws for a non-existent community", async () => {
    const user0 = await getUser("user0");
    await expect(editCommunity(user0, { communityId: "fake-id", name: "Nope" })).rejects.toThrow(
      "Community not found",
    );
  });
});

// ---------------------------------------------------------------------------
// setCommunityRole
// ---------------------------------------------------------------------------
describe("setCommunityRole", () => {
  it("owner can set a member to dj", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "RoleTest", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "dj");

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("dj");
  });

  it("owner can kick a member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickRole", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("kicked");
  });

  it("owner can ban a member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BanRole", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "banned");

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("banned");
  });

  it("owner can set a member back to member role", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "MemberRole", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "dj");
    await setCommunityRole(communityId, user0, "user1", "member");

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("member");
  });

  it("throws when a non-owner tries to change roles", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "NonOwnerRole", false);
    await joinCommunity(communityId, user1);
    await joinCommunity(communityId, user2);

    await expect(setCommunityRole(communityId, user1, "user2", "dj")).rejects.toThrow(
      "Only owner can modify roles",
    );
  });

  it("throws when trying to modify the owner's role", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "OwnerMod", false);
    await joinCommunity(communityId, user1);

    // Even the owner cannot change their own owner role via setCommunityRole
    await expect(setCommunityRole(communityId, user0, "user0", "member")).rejects.toThrow(
      "Cannot modify owner role",
    );
  });

  it("throws for invalid role", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "InvalidRole", false);
    await joinCommunity(communityId, user1);

    await expect(setCommunityRole(communityId, user0, "user1", "admin")).rejects.toThrow(
      "Invalid Role!",
    );
  });

  it("throws when the target user is not in the community", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "NoTarget", false);

    await expect(setCommunityRole(communityId, user0, "user1", "dj")).rejects.toThrow(
      "Target user is not in community",
    );
  });

  it("throws for a non-existent target user", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "NoUser", false);

    await expect(setCommunityRole(communityId, user0, "nonexistentuser", "dj")).rejects.toThrow(
      "Target user not found",
    );
  });

  it("throws for a non-existent community", async () => {
    const user0 = await getUser("user0");

    await expect(setCommunityRole("fake-id", user0, "user1", "dj")).rejects.toThrow(
      "Community not found",
    );
  });
});

// ---------------------------------------------------------------------------
// transferCommunityOwnership
// ---------------------------------------------------------------------------
describe("transferCommunityOwnership", () => {
  it("transfers ownership from owner to another member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "TransferTest", false);
    await joinCommunity(communityId, user1);

    const result = await transferCommunityOwnership(communityId, user0, "user1");
    const oldOwner = result.participants.find((p) => p.userId === user0.userId);
    const newOwner = result.participants.find((p) => p.userId === user1.userId);

    expect(oldOwner!.role).toBe("member");
    expect(newOwner!.role).toBe("owner");
  });

  it("can transfer ownership to a dj", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "TransferDj", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "dj");

    const result = await transferCommunityOwnership(communityId, user0, "user1");
    const newOwner = result.participants.find((p) => p.userId === user1.userId);
    expect(newOwner!.role).toBe("owner");
  });

  it("throws when a non-owner tries to transfer", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "NoTransfer", false);
    await joinCommunity(communityId, user1);

    await expect(transferCommunityOwnership(communityId, user1, "user0")).rejects.toThrow(
      "Only owner can transfer ownership",
    );
  });

  it("throws when transferring to a banned user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BanTransfer", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "banned");

    await expect(transferCommunityOwnership(communityId, user0, "user1")).rejects.toThrow(
      "Cannot transfer ownership to banned/kicked user",
    );
  });

  it("throws when transferring to a kicked user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickTransfer", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    await expect(transferCommunityOwnership(communityId, user0, "user1")).rejects.toThrow(
      "Cannot transfer ownership to banned/kicked user",
    );
  });

  it("throws when target user is not in the community", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "NoMemberTransfer", false);

    await expect(transferCommunityOwnership(communityId, user0, "user1")).rejects.toThrow(
      "Target user is not in community",
    );
  });

  it("throws for a non-existent target user", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "NoUserTransfer", false);

    await expect(transferCommunityOwnership(communityId, user0, "ghostuser")).rejects.toThrow(
      "Target user not found",
    );
  });

  it("throws for a non-existent community", async () => {
    const user0 = await getUser("user0");

    await expect(transferCommunityOwnership("fake-id", user0, "user1")).rejects.toThrow(
      "Community not found",
    );
  });
});

// ---------------------------------------------------------------------------
// createInvite
// ---------------------------------------------------------------------------
describe("createInvite", () => {
  it("creates an invite for a private community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "PrivInvite", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    expect(inviteId).toEqual(expect.any(String));

    const invite = await InviteTokenRepo.get(inviteId);
    expect(invite.communityId).toBe(communityId);
    expect(invite.targetUserId).toBe(user1.userId);
    expect(invite.createdBy).toBe(user0.userId);
  });

  it("throws when inviting to a public community", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "PubInvite", false);

    await expect(createInvite(user0.userId, communityId, "user1")).rejects.toThrow(
      "Only private communities require invites",
    );
  });

  it("throws when a non-owner tries to invite", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "PrivInvNoOwn", true);
    // user1 is not even in the community
    await expect(createInvite(user1.userId, communityId, "user2")).rejects.toThrow(
      "Only the community owner can invite users",
    );
  });

  it("throws when inviting a user who is already a member", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "AlreadyMember", true);
    // Manually add user1 as member via acceptInvite flow
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId, user1.userId);

    await expect(createInvite(user0.userId, communityId, "user1")).rejects.toThrow(
      "is already a member of this community",
    );
  });

  it("throws when inviting a banned user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BanInvite", true);
    // Add user1 via invite, then ban them
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId, user1.userId);
    await setCommunityRole(communityId, user0, "user1", "banned");

    await expect(createInvite(user0.userId, communityId, "user1")).rejects.toThrow(
      "Cannot invite a banned user",
    );
  });

  it("allows inviting a kicked user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickInvite", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId, user1.userId);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    // Should not throw — kicked users can be re-invited
    const newInviteId = await createInvite(user0.userId, communityId, "user1");
    expect(newInviteId).toEqual(expect.any(String));
  });

  it("throws when a pending invite already exists for the target user", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "DupInvite", true);
    await createInvite(user0.userId, communityId, "user1");

    await expect(createInvite(user0.userId, communityId, "user1")).rejects.toThrow(
      "already has a pending invite to this community",
    );
  });

  it("throws for a non-existent target user", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "NoUserInvite", true);

    await expect(createInvite(user0.userId, communityId, "ghostuser")).rejects.toThrow(
      'User "ghostuser" not found',
    );
  });

  it("throws for a non-existent community", async () => {
    const user0 = await getUser("user0");

    await expect(createInvite(user0.userId, "fake-id", "user1")).rejects.toThrow(
      "Community not found",
    );
  });
});

// ---------------------------------------------------------------------------
// getMyPendingInvites
// ---------------------------------------------------------------------------
describe("getMyPendingInvites", () => {
  it("returns pending invites for the user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "InviteList", true);
    await createInvite(user0.userId, communityId, "user1");

    const invites = await getMyPendingInvites(user1.userId);
    expect(invites.length).toBe(1);
    expect(invites[0].communityName).toBe("InviteList");
    expect(invites[0].inviterUsername).toBe("user0");
    expect(invites[0].communityId).toBe(communityId);
    expect(invites[0].inviteId).toEqual(expect.any(String));
    expect(invites[0].expiresAt).toEqual(expect.any(String));
  });

  it("returns empty array when no pending invites", async () => {
    const user1 = await getUser("user1");
    const invites = await getMyPendingInvites(user1.userId);
    expect(invites).toEqual([]);
  });

  it("excludes expired invites", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "ExpiredInvite", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    // Manually expire the invite
    const invite = await InviteTokenRepo.get(inviteId);
    await InviteTokenRepo.set(inviteId, { ...invite, expiresAt: new Date(0).toISOString() });

    const invites = await getMyPendingInvites(user1.userId);
    expect(invites).toEqual([]);
  });

  it("does not return invites for other users", async () => {
    const user0 = await getUser("user0");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "OtherInvite", true);
    await createInvite(user0.userId, communityId, "user1");

    const invites = await getMyPendingInvites(user2.userId);
    expect(invites).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------
describe("acceptInvite", () => {
  it("accepts a valid invite and adds the user to the community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "AcceptTest", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    await acceptInvite(inviteId, user1.userId);

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant).toBeDefined();
    expect(participant!.role).toBe("member");
  });

  it("expires the invite after acceptance", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "ExpireAfterAccept", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId, user1.userId);

    // Invite should now be expired
    const invites = await getMyPendingInvites(user1.userId);
    expect(invites).toEqual([]);
  });

  it("allows a kicked user to rejoin via invite", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "KickReInvite", true);
    const inviteId1 = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId1, user1.userId);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    const inviteId2 = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId2, user1.userId);

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("member");
  });

  it("throws when the invite is not for the user", async () => {
    const user0 = await getUser("user0");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "WrongUser", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    await expect(acceptInvite(inviteId, user2.userId)).rejects.toThrow(
      "This invite is not for you",
    );
  });

  it("throws when the invite has expired", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "ExpiredAccept", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    // Expire the invite
    const invite = await InviteTokenRepo.get(inviteId);
    await InviteTokenRepo.set(inviteId, { ...invite, expiresAt: new Date(0).toISOString() });

    await expect(acceptInvite(inviteId, user1.userId)).rejects.toThrow("This invite has expired");
  });

  it("throws when the user is banned from the community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "BanAccept", true);
    const inviteId1 = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId1, user1.userId);
    await setCommunityRole(communityId, user0, "user1", "banned");

    // Create a new invite (owner manually adds via repo to bypass the createInvite ban check)
    const inviteId2 = await InviteTokenRepo.add({
      communityId,
      targetUserId: user1.userId,
      createdBy: user0.userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await expect(acceptInvite(inviteId2, user1.userId)).rejects.toThrow(
      "You are banned from this community",
    );
  });

  it("throws when invite does not exist", async () => {
    const user1 = await getUser("user1");
    await expect(acceptInvite("nonexistent-invite", user1.userId)).rejects.toThrow(
      "Invite not found",
    );
  });

  it("throws when user is already a member (not kicked)", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "AlreadyIn", true);
    const inviteId1 = await createInvite(user0.userId, communityId, "user1");
    await acceptInvite(inviteId1, user1.userId);

    // Manually create another valid invite to bypass the duplicate check in createInvite
    const inviteId2 = await InviteTokenRepo.add({
      communityId,
      targetUserId: user1.userId,
      createdBy: user0.userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await expect(acceptInvite(inviteId2, user1.userId)).rejects.toThrow("You are already a member");
  });
});

// ---------------------------------------------------------------------------
// declineInvite
// ---------------------------------------------------------------------------
describe("declineInvite", () => {
  it("declines an invite by expiring it", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DeclineTest", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    await declineInvite(inviteId, user1.userId);

    // Invite should no longer appear in pending
    const invites = await getMyPendingInvites(user1.userId);
    expect(invites).toEqual([]);
  });

  it("user is not added to the community after decline", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DeclineNoJoin", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");
    await declineInvite(inviteId, user1.userId);

    const community = await CommunityRepo.get(communityId);
    const participant = community.participants.find((p) => p.userId === user1.userId);
    expect(participant).toBeUndefined();
  });

  it("throws when invite does not exist", async () => {
    const user1 = await getUser("user1");
    await expect(declineInvite("nonexistent", user1.userId)).rejects.toThrow("Invite not found");
  });

  it("throws when the invite is not for the user", async () => {
    const user0 = await getUser("user0");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "DeclineWrong", true);
    const inviteId = await createInvite(user0.userId, communityId, "user1");

    await expect(declineInvite(inviteId, user2.userId)).rejects.toThrow(
      "This invite is not for you",
    );
  });
});

// ---------------------------------------------------------------------------
// requestDj
// ---------------------------------------------------------------------------
describe("requestDj", () => {
  it("member can request DJ status", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqTest", false);
    await joinCommunity(communityId, user1);

    const result = await requestDj(communityId, user1);
    expect(result).toEqual([{ username: "user1", displayName: "Yāo" }]);
  });

  it("throws when owner requests DJ (already has permissions)", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "DjReqOwner", false);

    await expect(requestDj(communityId, user0)).rejects.toThrow("You already have DJ permissions");
  });

  it("throws when a DJ requests DJ again", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqDj", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "dj");

    await expect(requestDj(communityId, user1)).rejects.toThrow("You already have DJ permissions");
  });

  it("throws when a kicked user requests DJ", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqKick", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "kicked");

    await expect(requestDj(communityId, user1)).rejects.toThrow(
      "You are not an active member of this community",
    );
  });

  it("throws when a banned user requests DJ", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqBan", false);
    await joinCommunity(communityId, user1);
    await setCommunityRole(communityId, user0, "user1", "banned");

    await expect(requestDj(communityId, user1)).rejects.toThrow(
      "You are not an active member of this community",
    );
  });

  it("throws when a user already has a pending DJ request", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqDup", false);
    await joinCommunity(communityId, user1);
    await requestDj(communityId, user1);

    await expect(requestDj(communityId, user1)).rejects.toThrow(
      "You already have a pending DJ request",
    );
  });

  it("throws when the user is not a member of the community", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjReqNoMember", false);

    await expect(requestDj(communityId, user1)).rejects.toThrow(
      "You are not a member of this community",
    );
  });

  it("throws for a non-existent community", async () => {
    const user1 = await getUser("user1");

    await expect(requestDj("fake-id", user1)).rejects.toThrow("Community not found");
  });
});

// ---------------------------------------------------------------------------
// respondToDjRequest
// ---------------------------------------------------------------------------
describe("respondToDjRequest", () => {
  it("owner accepts a DJ request and promotes the user to DJ", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjAccept", false);
    await joinCommunity(communityId, user1);
    await requestDj(communityId, user1);

    const result = await respondToDjRequest(communityId, user0, "user1", true);
    const participant = result.community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("dj");
    expect(result.djRequests).toEqual([]); // request removed
    expect(result.requesterUserId).toBe(user1.userId);
  });

  it("owner declines a DJ request (user stays member)", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjDecline", false);
    await joinCommunity(communityId, user1);
    await requestDj(communityId, user1);

    const result = await respondToDjRequest(communityId, user0, "user1", false);
    const participant = result.community.participants.find((p) => p.userId === user1.userId);
    expect(participant!.role).toBe("member");
    expect(result.djRequests).toEqual([]);
  });

  it("throws when a non-owner responds to a DJ request", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "DjNonOwner", false);
    await joinCommunity(communityId, user1);
    await joinCommunity(communityId, user2);
    await requestDj(communityId, user1);

    await expect(respondToDjRequest(communityId, user2, "user1", true)).rejects.toThrow(
      "Only the owner can respond to DJ requests",
    );
  });

  it("throws when there is no pending DJ request from the user", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjNoReq", false);
    await joinCommunity(communityId, user1);

    await expect(respondToDjRequest(communityId, user0, "user1", true)).rejects.toThrow(
      "No pending DJ request from this user",
    );
  });

  it("throws for a non-existent requester username", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "DjGhost", false);

    await expect(respondToDjRequest(communityId, user0, "ghostuser", true)).rejects.toThrow(
      "Requester user not found",
    );
  });

  it("throws for a non-existent community", async () => {
    const user0 = await getUser("user0");

    await expect(respondToDjRequest("fake-id", user0, "user1", true)).rejects.toThrow(
      "Community not found",
    );
  });
});

// ---------------------------------------------------------------------------
// getDjRequests
// ---------------------------------------------------------------------------
describe("getDjRequests", () => {
  it("returns an empty array when there are no DJ requests", async () => {
    const user0 = await getUser("user0");

    const communityId = await createCommunity(user0.userId, "DjEmpty", false);
    const result = await getDjRequests(communityId);
    expect(result).toEqual([]);
  });

  it("returns pending DJ requests with username and displayName", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");

    const communityId = await createCommunity(user0.userId, "DjList", false);
    await joinCommunity(communityId, user1);
    await joinCommunity(communityId, user2);
    await requestDj(communityId, user1);
    await requestDj(communityId, user2);

    const result = await getDjRequests(communityId);
    expect(result).toEqual([
      { username: "user1", displayName: "Yāo" },
      { username: "user2", displayName: "Sénior Dos" },
    ]);
  });

  it("removes a request after it is accepted", async () => {
    const user0 = await getUser("user0");
    const user1 = await getUser("user1");

    const communityId = await createCommunity(user0.userId, "DjListAccepted", false);
    await joinCommunity(communityId, user1);
    await requestDj(communityId, user1);
    await respondToDjRequest(communityId, user0, "user1", true);

    const result = await getDjRequests(communityId);
    expect(result).toEqual([]);
  });

  it("throws for a non-existent community", async () => {
    await expect(getDjRequests("fake-id")).rejects.toThrow("Community not found");
  });
});
