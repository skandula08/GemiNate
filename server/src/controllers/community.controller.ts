import {
  withAuth,
  zNewCommunityRequest,
  zSetCommunityRolePayload,
  zTransferOwnershipPayload,
  zUpdateCommunityRequest,
  zCreateInvitePayload,
  zInviteActionPayload,
  zDjRequestPayload,
  zDjRequestResponsePayload,
  type CommunityInvite,
  type CommunityPreview,
  type UserAuth,
} from "@gamenite/shared";
import type { RestAPI, SocketAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth, enforceAuth } from "../services/auth.service.ts";
import {
  getMyCommunities as getMyCommunitiesFromService,
  getJoinableCommunities as getJoinableCommunitiesFromService,
  getCommunityOwnerUsername as getCommunityOwnerIdFromService,
  createCommunity,
  getCommunityBanner as getCommunityBannerFromService,
  joinCommunity,
  setCommunityRole,
  transferCommunityOwnership,
  getCommunity,
  editCommunity,
  createInvite,
  getMyPendingInvites,
  acceptInvite,
  declineInvite,
  requestDj,
  respondToDjRequest,
  getDjRequests,
} from "../services/community.services.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";
import { syncPlaylistRolesFromCommunity } from "../services/music.service.ts";
import { logSocketError } from "./socket.controller.ts";

/** Parse auth credentials from GET query parameters, supporting both auth kinds. */
function parseQueryAuth(query: {
  username?: unknown;
  password?: unknown;
  sessionToken?: unknown;
}): UserAuth | null {
  const username = z.string().safeParse(query.username);
  if (!username.success) return null;

  const password = z.string().safeParse(query.password);
  if (password.success) {
    return { kind: "password", username: username.data, password: password.data };
  }

  const sessionToken = z.string().safeParse(query.sessionToken);
  if (sessionToken.success) {
    return { kind: "google", username: username.data, sessionToken: sessionToken.data };
  }

  return null;
}

/**
 * Fetches the communities the authenticated user is a part of.
 * @returns Sends the list of communities or an error.
 */
export const getMyCommunities: RestAPI<CommunityPreview[]> = async (req, res) => {
  const auth = parseQueryAuth(req.query);
  if (!auth) {
    res.status(400).send({ error: "Poorly-formed request. Must include auth" });
    return;
  }

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getMyCommunitiesFromService(user.userId));
};

/**
 * Fetches the username of the owner of a specific community.
 * @returns Sends the owner's username or an error if community not found.
 */
export const getCommunityOwnerId: RestAPI<string> = async (req, res) => {
  const communityId = z.string().safeParse(req.query.communityId);

  if (!communityId.data) {
    res.status(403).send({ error: "No such community exists" });
    return;
  }

  const owner = await getCommunityOwnerIdFromService(communityId.data);

  if (!owner) {
    res.status(403).send({ error: "No such community exists" });
    return;
  }

  res.send(owner);
};

/**
 * Fetches the joinable communities for the authenticated user.
 * @returns Sends the list of joinable communities or an error.
 */
export const getJoinableCommunities: RestAPI<CommunityPreview[]> = async (req, res) => {
  const auth = parseQueryAuth(req.query);
  if (!auth) {
    res.status(400).send({ error: "Poorly-formed request. Must include auth" });
    return;
  }

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getJoinableCommunitiesFromService(user.userId));
};

/**
 * Fetches the community banner for a specific community.
 * @returns Sends the banner URL or an error.
 */
export const getCommunityBanner: RestAPI<string | undefined> = async (req, res) => {
  const communityId = z.string().safeParse(req.query.communityId);
  if (!communityId.data) {
    res.status(403).send({ error: "No such community exists" });
    return;
  }
  const banner = await getCommunityBannerFromService(communityId.data);

  res.send(banner);
};

/**
 * Creates a new community with provided data.
 * @returns Sends the created community's ID or an error.
 */
export const postCommunity: RestAPI<{ communityId: string }> = async (req, res) => {
  const body = withAuth(zNewCommunityRequest).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const {
    auth,
    payload: { name, description, isPrivate },
  } = body.data;

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const communityId = await createCommunity(user.userId, name, isPrivate, description);
    res.send({ communityId });
  } catch (err) {
    res
      .status(400)
      .send({ error: err instanceof Error ? err.message : "Failed to create community" });
  }
};

/**
 * Edits the community with the specified data.
 * @returns Sends the updated community's ID or an error.
 */
export const postEditCommunity: RestAPI<{ communityId: string }> = async (req, res) => {
  const body = withAuth(zUpdateCommunityRequest).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const {
    auth,
    payload: { communityId, name, description, banner },
  } = body.data;

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const id = await editCommunity(user, { communityId, name, description, banner });
    res.send({ communityId: id });
  } catch (err) {
    res
      .status(400)
      .send({ error: err instanceof Error ? err.message : "Failed to edit community" });
  }
};

/**
 * Handles joining a community's socket room.
 * @returns Emits community members' data and DJ requests if the user is the owner.
 */
export const socketCommunityPageJoin: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: communityId } = withAuth(z.string()).parse(body);
    const community = await getCommunity(communityId);
    const user = await enforceAuth(auth);

    if (community.isPrivate) {
      const participant = community.participants.find((p) => p.userId === user.userId);
      if (!participant || ["banned", "kicked"].includes(participant.role)) {
        throw new Error("You are not a member of this private community");
      }
    }

    // Join socket room
    await socket.join(communityId);
    io.to(communityId).emit(
      "communityMembersUpdated",
      await Promise.all(
        community.participants.map(async (participant) => ({
          user: await populateSafeUserInfo(participant.userId),
          role: participant.role,
        })),
      ),
    );

    // If the joining user is the owner, send them the current DJ requests
    const ownerParticipant = community.participants.find((p) => p.role === "owner");
    if (ownerParticipant && ownerParticipant.userId === user.userId) {
      const djReqs = await getDjRequests(communityId);
      socket.emit("communityDjRequestsUpdated", djReqs);
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handles leaving a community's socket room.
 * @returns Handles leaving the room.
 */
export const socketCommunityPageLeave: SocketAPI = (socket, io) => async (body) => {
  try {
    const { payload: communityId } = withAuth(z.string()).parse(body);

    // Join socket room
    if (socket.rooms.has(communityId)) await socket.leave(communityId);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Joins a community as a member via socket connection.
 * @returns Joins the community room and broadcasts member data.
 */
export const socketJoinAsMember: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: communityId } = withAuth(z.string()).parse(body);

    const user = await enforceAuth(auth);
    const community = await joinCommunity(communityId, user);
    if (!socket.rooms.has(communityId)) {
      await socket.join(communityId);
    }
    io.to(communityId).emit(
      "communityMembersUpdated",
      await Promise.all(
        community.participants.map(async (participant) => ({
          user: await populateSafeUserInfo(participant.userId),
          role: participant.role,
        })),
      ),
    );
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Sets a community member's role.
 * @returns Broadcasts updated community members and playlist roles.
 */
export const socketSetRole: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zSetCommunityRolePayload).parse(body);

    const user = await enforceAuth(auth);

    const community = await setCommunityRole(
      payload.communityId,
      user,
      payload.memberUsername,
      payload.role,
    );

    // Sync the playlist's owner/djList so music player permissions stay current
    const updatedPlaylist = await syncPlaylistRolesFromCommunity(payload.communityId);
    if (updatedPlaylist) {
      io.to(updatedPlaylist.playlistId).emit("musicPlaylistUpdate", {
        playlist: updatedPlaylist,
      });
    }

    if (!socket.rooms.has(payload.communityId)) {
      await socket.join(payload.communityId);
    }

    io.to(payload.communityId).emit(
      "communityMembersUpdated",
      await Promise.all(
        community.participants.map(async (participant) => ({
          user: await populateSafeUserInfo(participant.userId),
          role: participant.role,
        })),
      ),
    );
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Creates an invite to join a community.
 * @returns Sends the created invite ID or an error.
 */
export const postCreateInvite: RestAPI<{ inviteId: string }> = async (req, res) => {
  const body = withAuth(zCreateInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const {
    auth,
    payload: { communityId, targetUsername },
  } = body.data;

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const inviteId = await createInvite(user.userId, communityId, targetUsername);
    res.send({ inviteId });
  } catch (err) {
    res.status(400).send({ error: err instanceof Error ? err.message : "Failed to create invite" });
  }
};

/**
 * Fetches the invites pending acceptance for the authenticated user.
 * @returns Sends a list of pending invites or an error.
 */
export const getMyInvites: RestAPI<CommunityInvite[]> = async (req, res) => {
  const auth = parseQueryAuth(req.query);
  if (!auth) {
    res.status(400).send({ error: "Poorly-formed request. Must include auth" });
    return;
  }

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getMyPendingInvites(user.userId));
};

/**
 * Accepts an invite to join a community.
 * @returns Sends a success message or an error.
 */
export const postAcceptInvite: RestAPI<{ success: true }> = async (req, res) => {
  const body = withAuth(zInviteActionPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const {
    auth,
    payload: { inviteId },
  } = body.data;

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    await acceptInvite(inviteId, user.userId);
    res.send({ success: true });
  } catch (err) {
    res.status(400).send({ error: err instanceof Error ? err.message : "Failed to accept invite" });
  }
};

/**
 * Declines an invite to join a community.
 * @returns Sends a success message or an error.
 */
export const postDeclineInvite: RestAPI<{ success: true }> = async (req, res) => {
  const body = withAuth(zInviteActionPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const {
    auth,
    payload: { inviteId },
  } = body.data;

  const user = await checkAuth(auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    await declineInvite(inviteId, user.userId);
    res.send({ success: true });
  } catch (err) {
    res
      .status(400)
      .send({ error: err instanceof Error ? err.message : "Failed to decline invite" });
  }
};

/**
 * Transfers community ownership to another user.
 * @returns Transfers ownership, syncs playlist roles, and broadcasts updated community members.
 */
export const socketTransferOwnership: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zTransferOwnershipPayload).parse(body);

    const user = await enforceAuth(auth);

    const community = await transferCommunityOwnership(
      payload.communityId,
      user,
      payload.memberUsername,
    );

    // Sync the playlist's owner/djList so music player permissions stay current
    const updatedPlaylist = await syncPlaylistRolesFromCommunity(payload.communityId);
    if (updatedPlaylist) {
      io.to(updatedPlaylist.playlistId).emit("musicPlaylistUpdate", {
        playlist: updatedPlaylist,
      });
    }

    if (!socket.rooms.has(payload.communityId)) {
      await socket.join(payload.communityId);
    }

    io.to(payload.communityId).emit(
      "communityMembersUpdated",
      await Promise.all(
        community.participants.map(async (participant) => ({
          user: await populateSafeUserInfo(participant.userId),
          role: participant.role,
        })),
      ),
    );
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Responds to a DJ request in a community.
 * @returns Sends updated DJ requests and broadcasts the result of the request.
 */
export const socketRequestDj: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zDjRequestPayload).parse(body);
    const user = await enforceAuth(auth);

    const djRequests = await requestDj(payload.communityId, user);

    // Broadcast updated DJ requests to all members in the community room
    // (only the owner's UI will display them, but this keeps state in sync)
    io.to(payload.communityId).emit("communityDjRequestsUpdated", djRequests);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Responds to a DJ request in a community.
 * @returns Sends updated DJ requests and broadcasts the result of the request.
 */
export const socketRespondDjRequest: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zDjRequestResponsePayload).parse(body);
    const user = await enforceAuth(auth);

    const { community, djRequests } = await respondToDjRequest(
      payload.communityId,
      user,
      payload.requesterUsername,
      payload.accepted,
    );

    // Send updated DJ requests to the room
    io.to(payload.communityId).emit("communityDjRequestsUpdated", djRequests);

    // Notify the requester of the result
    // We broadcast to the whole room; the client filters by own username
    io.to(payload.communityId).emit("communityDjRequestResult", {
      accepted: payload.accepted,
    });

    // If accepted, broadcast updated members (role changed to DJ) and sync playlist
    if (payload.accepted) {
      const updatedPlaylist = await syncPlaylistRolesFromCommunity(payload.communityId);
      if (updatedPlaylist) {
        io.to(updatedPlaylist.playlistId).emit("musicPlaylistUpdate", {
          playlist: updatedPlaylist,
        });
      }

      io.to(payload.communityId).emit(
        "communityMembersUpdated",
        await Promise.all(
          community.participants.map(async (participant) => ({
            user: await populateSafeUserInfo(participant.userId),
            role: participant.role,
          })),
        ),
      );
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};
