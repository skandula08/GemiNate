import { describe, expect, it, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";
import {
  createCommunity,
  joinCommunity,
  requestDj,
  createInvite,
} from "../src/services/community.services.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import {
  socketCommunityPageJoin,
  socketCommunityPageLeave,
  socketJoinAsMember,
  socketSetRole,
  socketTransferOwnership,
  socketRequestDj,
  socketRespondDjRequest,
} from "../src/controllers/community.controller.ts";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

vi.mock(import("../src/services/music.service.ts"), async (orig) => {
  const actual = await orig();
  return { ...actual, syncPlaylistRolesFromCommunity: vi.fn().mockResolvedValue(null) };
});

import { logSocketError } from "../src/controllers/socket.controller.ts";
import { syncPlaylistRolesFromCommunity } from "../src/services/music.service.ts";

// ── Auth helpers ───────────────────────────────────────────────────────────────

const auth0 = { kind: "password" as const, username: "user0", password: "pwd0000" };
const auth1 = { kind: "password" as const, username: "user1", password: "pwd1111" };
const auth2 = { kind: "password" as const, username: "user2", password: "pwd2222" };
// eslint-disable-next-line @typescript-eslint/naming-convention
const _auth3 = { kind: "password" as const, username: "user3", password: "pwd3333" };
const authBad = { kind: "password" as const, username: "user0", password: "wrong" };

// ── Mock socket / IO factory ───────────────────────────────────────────────────

function createMockSocket() {
  const mockSocket = {
    id: "mock-socket-id",
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => mockSocket),
    rooms: new Set<string>(),
  } as unknown as GameServerSocket;
  return mockSocket;
}

function createMockIO() {
  const mockIO = {
    to: vi.fn(() => mockIO),
    emit: vi.fn(),
  } as unknown as GameServer;
  return mockIO;
}

// ── Helper: create a community for a user via the service layer ────────────────

async function createTestCommunity(
  ownerUsername: string,
  name: string,
  isPrivate = false,
  description?: string,
) {
  const user = await getUserByUsername(ownerUsername);
  if (!user) throw new Error(`Test user ${ownerUsername} not found`);
  return createCommunity(user.userId, name, isPrivate, description);
}

async function joinTestCommunity(communityId: string, username: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Test user ${username} not found`);
  return joinCommunity(communityId, user);
}

// =============================================================================
// REST ENDPOINT TESTS
// =============================================================================

describe("GET /api/communities/ownerID", () => {
  it("should return 403 when communityId query param is missing", async () => {
    const response = await supertest(app).get("/api/communities/ownerID");
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "No such community exists" });
  });

  it("should return the owner's username for a valid community", async () => {
    const communityId = await createTestCommunity("user0", "Owner Test Community");

    const response = await supertest(app).get("/api/communities/ownerID").query({ communityId });
    expect(response.status).toBe(200);
    expect(response.text).toBe("user0");
  });

  it("should return 500 for a non-existent communityId (repo throws)", async () => {
    const response = await supertest(app)
      .get("/api/communities/ownerID")
      .query({ communityId: "nonexistent-id" });
    // The service calls CommunityRepo.get() which throws for missing keys,
    // and the global Express error handler returns 500.
    expect(response.status).toBe(500);
  });
});

describe("GET /api/communities/banner", () => {
  it("should return 403 when communityId query param is missing", async () => {
    const response = await supertest(app).get("/api/communities/banner");
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "No such community exists" });
  });

  it("should return empty when community has no banner", async () => {
    const communityId = await createTestCommunity("user0", "No Banner Community");

    const response = await supertest(app).get("/api/communities/banner").query({ communityId });
    expect(response.status).toBe(200);
    // No banner set, so body should be empty/falsy
  });

  it("should return the banner after it has been set via edit", async () => {
    const communityId = await createTestCommunity("user0", "Banner Community");

    // Edit the community to set a banner
    await supertest(app)
      .post("/api/communities/edit")
      .send({
        auth: auth0,
        payload: {
          communityId,
          name: "Banner Community",
          banner: "https://example.com/banner.jpg",
        },
      });

    const response = await supertest(app).get("/api/communities/banner").query({ communityId });
    expect(response.status).toBe(200);
    expect(response.text).toBe("https://example.com/banner.jpg");
  });
});

describe("POST /api/communities/edit", () => {
  it("should return 400 on ill-formed payload", async () => {
    const response = await supertest(app)
      .post("/api/communities/edit")
      .send({ auth: auth0, payload: "not-an-object" });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with invalid credentials", async () => {
    const communityId = await createTestCommunity("user0", "Edit Auth Community");

    const response = await supertest(app)
      .post("/api/communities/edit")
      .send({
        auth: authBad,
        payload: { communityId, name: "New Name" },
      });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should successfully edit community name", async () => {
    const communityId = await createTestCommunity("user0", "Original Name");

    const response = await supertest(app)
      .post("/api/communities/edit")
      .send({
        auth: auth0,
        payload: { communityId, name: "Updated Name" },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId });
  });

  it("should successfully edit community description and banner", async () => {
    const communityId = await createTestCommunity("user0", "Full Edit Community");

    const response = await supertest(app)
      .post("/api/communities/edit")
      .send({
        auth: auth0,
        payload: {
          communityId,
          name: "Full Edit Community",
          description: "New description",
          banner: "https://example.com/new-banner.jpg",
        },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId });

    // Verify banner was set
    const bannerRes = await supertest(app).get("/api/communities/banner").query({ communityId });
    expect(bannerRes.text).toBe("https://example.com/new-banner.jpg");
  });

  it("should return 400 when non-owner tries to edit", async () => {
    const communityId = await createTestCommunity("user0", "Non-Owner Edit");
    await joinTestCommunity(communityId, "user1");

    const response = await supertest(app)
      .post("/api/communities/edit")
      .send({
        auth: auth1,
        payload: { communityId, name: "Attempted Edit" },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Only owner can edit community");
  });
});

describe("POST /api/communities/invite", () => {
  it("should return 400 on ill-formed payload", async () => {
    const response = await supertest(app).post("/api/communities/invite").send({ auth: auth0 });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with invalid credentials", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite")
      .send({
        auth: authBad,
        payload: { communityId: "some-id", targetUsername: "user1" },
      });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should successfully create an invite for a private community", async () => {
    const communityId = await createTestCommunity("user0", "Private Invite Community", true);

    const response = await supertest(app)
      .post("/api/communities/invite")
      .send({
        auth: auth0,
        payload: { communityId, targetUsername: "user1" },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ inviteId: expect.any(String) });
  });

  it("should return 400 when inviting to a public community", async () => {
    const communityId = await createTestCommunity("user0", "Public Invite Community", false);

    const response = await supertest(app)
      .post("/api/communities/invite")
      .send({
        auth: auth0,
        payload: { communityId, targetUsername: "user1" },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Only private communities require invites");
  });

  it("should return 400 when non-owner tries to invite", async () => {
    const communityId = await createTestCommunity("user0", "Owner-Only Invite", true);
    // user1 gets invited and accepts so they're a member, but not owner
    const user1 = await getUserByUsername("user1");
    const inviteId = await createInvite(
      (await getUserByUsername("user0"))!.userId,
      communityId,
      "user1",
    );
    const { acceptInvite } = await import("../src/services/community.services.ts");
    await acceptInvite(inviteId, user1!.userId);

    const response = await supertest(app)
      .post("/api/communities/invite")
      .send({
        auth: auth1,
        payload: { communityId, targetUsername: "user2" },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Only the community owner can invite users");
  });
});

describe("GET /api/communities/my-invites", () => {
  it("should return 400 when auth query params are missing", async () => {
    const response = await supertest(app).get("/api/communities/my-invites");
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request. Must include auth" });
  });

  it("should return 403 with invalid credentials", async () => {
    const response = await supertest(app)
      .get("/api/communities/my-invites")
      .query({ username: authBad.username, password: authBad.password });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should return empty array when user has no invites", async () => {
    const response = await supertest(app)
      .get("/api/communities/my-invites")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should return pending invites for the user", async () => {
    const communityId = await createTestCommunity("user0", "Invite Query Community", true);
    const user0 = await getUserByUsername("user0");
    await createInvite(user0!.userId, communityId, "user1");

    const response = await supertest(app)
      .get("/api/communities/my-invites")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      inviteId: expect.any(String),
      communityId,
      communityName: "Invite Query Community",
      inviterUsername: "user0",
      expiresAt: expect.any(String),
    });
  });
});

describe("POST /api/communities/invite/accept", () => {
  it("should return 400 on ill-formed payload", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/accept")
      .send({ auth: auth1 });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with invalid credentials", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/accept")
      .send({
        auth: authBad,
        payload: { inviteId: "some-id" },
      });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should successfully accept an invite and join the community", async () => {
    const communityId = await createTestCommunity("user0", "Accept Invite Community", true);
    const user0 = await getUserByUsername("user0");
    const inviteId = await createInvite(user0!.userId, communityId, "user1");

    const response = await supertest(app).post("/api/communities/invite/accept").send({
      auth: auth1,
      payload: { inviteId },
    });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ success: true });

    // Verify user1 is now a member
    const myComms = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth1.username, password: auth1.password });
    expect(myComms.body).toMatchObject([{ communityId, name: "Accept Invite Community" }]);
  });

  it("should return 400 when accepting a non-existent invite", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/accept")
      .send({
        auth: auth1,
        payload: { inviteId: "nonexistent-invite" },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invite not found");
  });

  it("should return 400 when a different user tries to accept the invite", async () => {
    const communityId = await createTestCommunity("user0", "Wrong User Accept", true);
    const user0 = await getUserByUsername("user0");
    const inviteId = await createInvite(user0!.userId, communityId, "user1");

    // user2 tries to accept user1's invite
    const response = await supertest(app).post("/api/communities/invite/accept").send({
      auth: auth2,
      payload: { inviteId },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("This invite is not for you");
  });
});

describe("POST /api/communities/invite/decline", () => {
  it("should return 400 on ill-formed payload", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/decline")
      .send({ auth: auth1 });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with invalid credentials", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/decline")
      .send({
        auth: authBad,
        payload: { inviteId: "some-id" },
      });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should successfully decline an invite", async () => {
    const communityId = await createTestCommunity("user0", "Decline Invite Community", true);
    const user0 = await getUserByUsername("user0");
    const inviteId = await createInvite(user0!.userId, communityId, "user1");

    const response = await supertest(app).post("/api/communities/invite/decline").send({
      auth: auth1,
      payload: { inviteId },
    });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ success: true });

    // Verify the invite is no longer pending
    const invitesRes = await supertest(app)
      .get("/api/communities/my-invites")
      .query({ username: auth1.username, password: auth1.password });
    expect(invitesRes.body).toStrictEqual([]);
  });

  it("should return 400 when declining a non-existent invite", async () => {
    const response = await supertest(app)
      .post("/api/communities/invite/decline")
      .send({
        auth: auth1,
        payload: { inviteId: "nonexistent-invite" },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invite not found");
  });

  it("should return 400 when a different user tries to decline", async () => {
    const communityId = await createTestCommunity("user0", "Wrong User Decline", true);
    const user0 = await getUserByUsername("user0");
    const inviteId = await createInvite(user0!.userId, communityId, "user1");

    const response = await supertest(app).post("/api/communities/invite/decline").send({
      auth: auth2,
      payload: { inviteId },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("This invite is not for you");
  });
});

// =============================================================================
// SOCKET HANDLER TESTS
// =============================================================================

describe("socketCommunityPageJoin", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
  });

  it("should join the socket room and emit communityMembersUpdated", async () => {
    const communityId = await createTestCommunity("user0", "Socket Join Community");

    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: auth0, payload: communityId });

    expect(mockSocket.join).toHaveBeenCalledWith(communityId);
    expect(mockIO.to).toHaveBeenCalledWith(communityId);
    expect((mockIO.to as ReturnType<typeof vi.fn>).mock.results[0].value.emit).toHaveBeenCalledWith(
      "communityMembersUpdated",
      expect.arrayContaining([
        expect.objectContaining({
          role: "owner",
          user: expect.objectContaining({ username: "user0" }),
        }),
      ]),
    );
  });

  it("should send DJ requests to owner on join", async () => {
    const communityId = await createTestCommunity("user0", "DJ Requests Owner Join");
    await joinTestCommunity(communityId, "user1");

    // user1 requests DJ
    const user1 = await getUserByUsername("user1");
    await requestDj(communityId, user1!);

    // Owner joins the page
    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: auth0, payload: communityId });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "communityDjRequestsUpdated",
      expect.arrayContaining([expect.objectContaining({ username: "user1" })]),
    );
  });

  it("should NOT send DJ requests when a non-owner joins", async () => {
    const communityId = await createTestCommunity("user0", "Non-Owner DJ Join");
    await joinTestCommunity(communityId, "user1");

    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    // socket.emit should not have been called with communityDjRequestsUpdated
    const djCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === "communityDjRequestsUpdated",
    );
    expect(djCalls).toHaveLength(0);
  });

  it("should block non-members from joining a private community", async () => {
    const communityId = await createTestCommunity("user0", "Private Socket Join", true);

    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({
        message: "You are not a member of this private community",
      }),
    );
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should log error for invalid auth", async () => {
    const communityId = await createTestCommunity("user0", "Bad Auth Socket Join");

    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: authBad, payload: communityId });

    expect(logSocketError).toHaveBeenCalled();
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should allow a member to join a private community room", async () => {
    const communityId = await createTestCommunity("user0", "Private Member Join", true);

    // Invite and accept user1
    const user0 = await getUserByUsername("user0");
    const inviteId = await createInvite(user0!.userId, communityId, "user1");
    const { acceptInvite } = await import("../src/services/community.services.ts");
    const user1 = await getUserByUsername("user1");
    await acceptInvite(inviteId, user1!.userId);

    const handler = socketCommunityPageJoin(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    expect(mockSocket.join).toHaveBeenCalledWith(communityId);
  });
});

describe("socketCommunityPageLeave", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
  });

  it("should leave the socket room when the socket is in the room", async () => {
    const communityId = await createTestCommunity("user0", "Socket Leave Community");
    mockSocket.rooms.add(communityId);

    const handler = socketCommunityPageLeave(mockSocket, mockIO);
    await handler({ auth: auth0, payload: communityId });

    expect(mockSocket.leave).toHaveBeenCalledWith(communityId);
  });

  it("should not call leave when the socket is not in the room", async () => {
    const communityId = await createTestCommunity("user0", "Not In Room Leave");

    const handler = socketCommunityPageLeave(mockSocket, mockIO);
    await handler({ auth: auth0, payload: communityId });

    expect(mockSocket.leave).not.toHaveBeenCalled();
  });

  it("should log error on malformed payload", async () => {
    const handler = socketCommunityPageLeave(mockSocket, mockIO);
    await handler("not-valid-json");

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketJoinAsMember", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
  });

  it("should join as member, join socket room, and emit communityMembersUpdated", async () => {
    const communityId = await createTestCommunity("user0", "Join Member Community");

    const handler = socketJoinAsMember(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    expect(mockSocket.join).toHaveBeenCalledWith(communityId);
    expect(mockIO.to).toHaveBeenCalledWith(communityId);
    expect((mockIO.to as ReturnType<typeof vi.fn>).mock.results[0].value.emit).toHaveBeenCalledWith(
      "communityMembersUpdated",
      expect.arrayContaining([
        expect.objectContaining({
          role: "owner",
          user: expect.objectContaining({ username: "user0" }),
        }),
        expect.objectContaining({
          role: "member",
          user: expect.objectContaining({ username: "user1" }),
        }),
      ]),
    );
  });

  it("should not duplicate socket.join if already in the room", async () => {
    const communityId = await createTestCommunity("user0", "Already In Room Join");
    mockSocket.rooms.add(communityId);

    const handler = socketJoinAsMember(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    // socket.join should NOT be called since socket is already in the room
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should log error when joining a private community directly", async () => {
    const communityId = await createTestCommunity("user0", "Private Direct Join", true);

    const handler = socketJoinAsMember(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("should log error with invalid auth", async () => {
    const communityId = await createTestCommunity("user0", "Bad Auth Join");

    const handler = socketJoinAsMember(mockSocket, mockIO);
    await handler({ auth: authBad, payload: communityId });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("should log error when user is already a member", async () => {
    const communityId = await createTestCommunity("user0", "Already Member Join");
    await joinTestCommunity(communityId, "user1");

    const handler = socketJoinAsMember(mockSocket, mockIO);
    await handler({ auth: auth1, payload: communityId });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({
        message: expect.stringContaining("joining community they are in already"),
      }),
    );
  });
});

describe("socketSetRole", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
    vi.mocked(syncPlaylistRolesFromCommunity).mockClear();
  });

  it("should set a member's role to dj and emit communityMembersUpdated", async () => {
    const communityId = await createTestCommunity("user0", "Set Role Community");
    await joinTestCommunity(communityId, "user1");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "dj" },
    });

    expect(syncPlaylistRolesFromCommunity).toHaveBeenCalledWith(communityId);
    expect(mockIO.to).toHaveBeenCalledWith(communityId);
    // Find the communityMembersUpdated emit
    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);
    const membersUpdate = emitCalls.find((c) => c[0] === "communityMembersUpdated");
    expect(membersUpdate).toBeDefined();
    expect(membersUpdate![1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "dj",
          user: expect.objectContaining({ username: "user1" }),
        }),
      ]),
    );
  });

  it("should kick a member", async () => {
    const communityId = await createTestCommunity("user0", "Kick Role Community");
    await joinTestCommunity(communityId, "user1");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "kicked" },
    });

    expect(syncPlaylistRolesFromCommunity).toHaveBeenCalledWith(communityId);
  });

  it("should ban a member", async () => {
    const communityId = await createTestCommunity("user0", "Ban Role Community");
    await joinTestCommunity(communityId, "user1");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "banned" },
    });

    expect(syncPlaylistRolesFromCommunity).toHaveBeenCalledWith(communityId);
  });

  it("should log error when non-owner tries to set role", async () => {
    const communityId = await createTestCommunity("user0", "Non-Owner Set Role");
    await joinTestCommunity(communityId, "user1");
    await joinTestCommunity(communityId, "user2");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId, memberUsername: "user2", role: "dj" },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "Only owner can modify roles" }),
    );
  });

  it("should log error when trying to modify owner role", async () => {
    const communityId = await createTestCommunity("user0", "Modify Owner Role");
    await joinTestCommunity(communityId, "user1");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user0", role: "member" },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "Cannot modify owner role" }),
    );
  });

  it("should join socket room if not already in it", async () => {
    const communityId = await createTestCommunity("user0", "Auto Join Room Set Role");
    await joinTestCommunity(communityId, "user1");

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "dj" },
    });

    expect(mockSocket.join).toHaveBeenCalledWith(communityId);
  });

  it("should not re-join socket room if already in it", async () => {
    const communityId = await createTestCommunity("user0", "No Re-Join Set Role");
    await joinTestCommunity(communityId, "user1");
    mockSocket.rooms.add(communityId);

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "dj" },
    });

    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("should emit musicPlaylistUpdate when syncPlaylistRolesFromCommunity returns a playlist", async () => {
    const communityId = await createTestCommunity("user0", "Playlist Sync Set Role");
    await joinTestCommunity(communityId, "user1");

    const fakePlaylist = { playlistId: "pl-123", name: "test" };
    vi.mocked(syncPlaylistRolesFromCommunity).mockResolvedValueOnce(fakePlaylist as never);

    const handler = socketSetRole(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1", role: "dj" },
    });

    expect(mockIO.to).toHaveBeenCalledWith("pl-123");
    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);
    const playlistUpdate = emitCalls.find((c) => c[0] === "musicPlaylistUpdate");
    expect(playlistUpdate).toBeDefined();
    expect(playlistUpdate![1]).toStrictEqual({ playlist: fakePlaylist });
  });
});

describe("socketTransferOwnership", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
    vi.mocked(syncPlaylistRolesFromCommunity).mockClear();
  });

  it("should transfer ownership and emit communityMembersUpdated", async () => {
    const communityId = await createTestCommunity("user0", "Transfer Ownership Community");
    await joinTestCommunity(communityId, "user1");

    const handler = socketTransferOwnership(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1" },
    });

    expect(syncPlaylistRolesFromCommunity).toHaveBeenCalledWith(communityId);
    expect(mockIO.to).toHaveBeenCalledWith(communityId);

    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);
    const membersUpdate = emitCalls.find((c) => c[0] === "communityMembersUpdated");
    expect(membersUpdate).toBeDefined();
    // user1 should now be owner, user0 should be member
    expect(membersUpdate![1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "owner",
          user: expect.objectContaining({ username: "user1" }),
        }),
        expect.objectContaining({
          role: "member",
          user: expect.objectContaining({ username: "user0" }),
        }),
      ]),
    );
  });

  it("should log error when non-owner tries to transfer", async () => {
    const communityId = await createTestCommunity("user0", "Non-Owner Transfer");
    await joinTestCommunity(communityId, "user1");
    await joinTestCommunity(communityId, "user2");

    const handler = socketTransferOwnership(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId, memberUsername: "user2" },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "Only owner can transfer ownership" }),
    );
  });

  it("should log error when transferring to non-existent user", async () => {
    const communityId = await createTestCommunity("user0", "Transfer Non-Existent");

    const handler = socketTransferOwnership(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "nobody" },
    });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("should join the socket room if not already in it", async () => {
    const communityId = await createTestCommunity("user0", "Transfer Auto Join");
    await joinTestCommunity(communityId, "user1");

    const handler = socketTransferOwnership(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1" },
    });

    expect(mockSocket.join).toHaveBeenCalledWith(communityId);
  });

  it("should emit musicPlaylistUpdate when syncPlaylistRolesFromCommunity returns a playlist", async () => {
    const communityId = await createTestCommunity("user0", "Transfer Playlist Sync");
    await joinTestCommunity(communityId, "user1");

    const fakePlaylist = { playlistId: "pl-transfer", name: "test" };
    vi.mocked(syncPlaylistRolesFromCommunity).mockResolvedValueOnce(fakePlaylist as never);

    const handler = socketTransferOwnership(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, memberUsername: "user1" },
    });

    expect(mockIO.to).toHaveBeenCalledWith("pl-transfer");
    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);
    const playlistUpdate = emitCalls.find((c) => c[0] === "musicPlaylistUpdate");
    expect(playlistUpdate).toBeDefined();
  });
});

describe("socketRequestDj", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
  });

  it("should submit DJ request and emit communityDjRequestsUpdated", async () => {
    const communityId = await createTestCommunity("user0", "DJ Request Community");
    await joinTestCommunity(communityId, "user1");

    const handler = socketRequestDj(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId },
    });

    expect(mockIO.to).toHaveBeenCalledWith(communityId);
    expect((mockIO.to as ReturnType<typeof vi.fn>).mock.results[0].value.emit).toHaveBeenCalledWith(
      "communityDjRequestsUpdated",
      expect.arrayContaining([expect.objectContaining({ username: "user1" })]),
    );
  });

  it("should log error when owner requests DJ", async () => {
    const communityId = await createTestCommunity("user0", "Owner DJ Request");

    const handler = socketRequestDj(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "You already have DJ permissions" }),
    );
  });

  it("should log error when non-member requests DJ", async () => {
    const communityId = await createTestCommunity("user0", "Non-Member DJ Request");

    const handler = socketRequestDj(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "You are not a member of this community" }),
    );
  });

  it("should log error on duplicate DJ request", async () => {
    const communityId = await createTestCommunity("user0", "Duplicate DJ Request");
    await joinTestCommunity(communityId, "user1");

    // First request
    const user1 = await getUserByUsername("user1");
    await requestDj(communityId, user1!);

    // Second request via socket handler
    const handler = socketRequestDj(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "You already have a pending DJ request" }),
    );
  });

  it("should log error with invalid auth", async () => {
    const communityId = await createTestCommunity("user0", "Bad Auth DJ Request");

    const handler = socketRequestDj(mockSocket, mockIO);
    await handler({
      auth: authBad,
      payload: { communityId },
    });

    expect(logSocketError).toHaveBeenCalled();
  });
});

describe("socketRespondDjRequest", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIO = createMockIO();
    vi.mocked(logSocketError).mockClear();
    vi.mocked(syncPlaylistRolesFromCommunity).mockClear();
  });

  it("should accept a DJ request, emit events, and sync playlist", async () => {
    const communityId = await createTestCommunity("user0", "Accept DJ Response");
    await joinTestCommunity(communityId, "user1");
    const user1 = await getUserByUsername("user1");
    await requestDj(communityId, user1!);

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, requesterUsername: "user1", accepted: true },
    });

    expect(syncPlaylistRolesFromCommunity).toHaveBeenCalledWith(communityId);

    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);

    // Should emit communityDjRequestsUpdated
    const djRequestsUpdate = emitCalls.find((c) => c[0] === "communityDjRequestsUpdated");
    expect(djRequestsUpdate).toBeDefined();

    // Should emit communityDjRequestResult with accepted: true
    const djResult = emitCalls.find((c) => c[0] === "communityDjRequestResult");
    expect(djResult).toBeDefined();
    expect(djResult![1]).toStrictEqual({ accepted: true });

    // Should emit communityMembersUpdated with user1 promoted to dj
    const membersUpdate = emitCalls.find((c) => c[0] === "communityMembersUpdated");
    expect(membersUpdate).toBeDefined();
    expect(membersUpdate![1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "dj",
          user: expect.objectContaining({ username: "user1" }),
        }),
      ]),
    );
  });

  it("should decline a DJ request and emit events without syncing playlist", async () => {
    const communityId = await createTestCommunity("user0", "Decline DJ Response");
    await joinTestCommunity(communityId, "user1");
    const user1 = await getUserByUsername("user1");
    await requestDj(communityId, user1!);

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, requesterUsername: "user1", accepted: false },
    });

    // Should NOT call syncPlaylistRolesFromCommunity when declined
    expect(syncPlaylistRolesFromCommunity).not.toHaveBeenCalled();

    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);

    // Should emit communityDjRequestsUpdated
    const djRequestsUpdate = emitCalls.find((c) => c[0] === "communityDjRequestsUpdated");
    expect(djRequestsUpdate).toBeDefined();

    // Should emit communityDjRequestResult with accepted: false
    const djResult = emitCalls.find((c) => c[0] === "communityDjRequestResult");
    expect(djResult).toBeDefined();
    expect(djResult![1]).toStrictEqual({ accepted: false });

    // Should NOT emit communityMembersUpdated when declined
    const membersUpdate = emitCalls.find((c) => c[0] === "communityMembersUpdated");
    expect(membersUpdate).toBeUndefined();
  });

  it("should log error when non-owner tries to respond", async () => {
    const communityId = await createTestCommunity("user0", "Non-Owner DJ Respond");
    await joinTestCommunity(communityId, "user1");
    await joinTestCommunity(communityId, "user2");

    const user2 = await getUserByUsername("user2");
    await requestDj(communityId, user2!);

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: auth1,
      payload: { communityId, requesterUsername: "user2", accepted: true },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "Only the owner can respond to DJ requests" }),
    );
  });

  it("should log error when no pending request exists for the user", async () => {
    const communityId = await createTestCommunity("user0", "No Pending DJ");
    await joinTestCommunity(communityId, "user1");

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, requesterUsername: "user1", accepted: true },
    });

    expect(logSocketError).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ message: "No pending DJ request from this user" }),
    );
  });

  it("should log error with invalid auth", async () => {
    const communityId = await createTestCommunity("user0", "Bad Auth DJ Respond");

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: authBad,
      payload: { communityId, requesterUsername: "user1", accepted: true },
    });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("should emit musicPlaylistUpdate when accept and syncPlaylistRolesFromCommunity returns a playlist", async () => {
    const communityId = await createTestCommunity("user0", "Accept DJ Playlist Sync");
    await joinTestCommunity(communityId, "user1");
    const user1 = await getUserByUsername("user1");
    await requestDj(communityId, user1!);

    const fakePlaylist = { playlistId: "pl-dj-accept", name: "test" };
    vi.mocked(syncPlaylistRolesFromCommunity).mockResolvedValueOnce(fakePlaylist as never);

    const handler = socketRespondDjRequest(mockSocket, mockIO);
    await handler({
      auth: auth0,
      payload: { communityId, requesterUsername: "user1", accepted: true },
    });

    expect(mockIO.to).toHaveBeenCalledWith("pl-dj-accept");
    const toMock = mockIO.to as ReturnType<typeof vi.fn>;
    const emitCalls = toMock.mock.results
      .map((r) => r.value.emit as ReturnType<typeof vi.fn>)
      .flatMap((fn) => fn.mock.calls);
    const playlistUpdate = emitCalls.find((c) => c[0] === "musicPlaylistUpdate");
    expect(playlistUpdate).toBeDefined();
    expect(playlistUpdate![1]).toStrictEqual({ playlist: fakePlaylist });
  });
});
