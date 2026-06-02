import type { APIResponse } from "../util/types";
import type { CommunityInvite, CommunityPreview, ErrorMsg, UserAuth } from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api";

/** Builds query string params for a UserAuth credential */
function authToParams(auth: UserAuth): string {
  if (auth.kind === "password") {
    return `username=${encodeURIComponent(auth.username)}&password=${encodeURIComponent(auth.password)}`;
  }
  return `username=${encodeURIComponent(auth.username)}&sessionToken=${encodeURIComponent(auth.sessionToken)}`;
}

/**
 * Sends a GET request to get the communities the user is a part of
 * @returns promise resolving to the list of communities
 */
export const getMyCommunities = async (auth: UserAuth): APIResponse<CommunityPreview[]> => {
  try {
    const res = await api.get<CommunityPreview[]>(
      `/api/communities/my-communities?${authToParams(auth)}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * sends a GET request to get the communities the user can join
 * @returns a promise resolving to the list of communities
 */
export const getJoinableCommunties = async (auth: UserAuth): APIResponse<CommunityPreview[]> => {
  try {
    const res = await api.get<CommunityPreview[]>(
      `/api/communities/joinable?${authToParams(auth)}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * sends a POST request to create a community
 * @returns the new community
 */
export const createCommunity = async (
  auth: UserAuth,
  name: string,
  description: string | undefined,
  isPrivate: boolean,
): APIResponse<{ communityId: string }> => {
  try {
    const res = await api.post<{ communityId: string } | ErrorMsg>(`/api/communities/create`, {
      auth,
      payload: {
        name,
        description,
        isPrivate,
      },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * sends a GET request to get the owner of a community
 * @returns the owner's username
 */
export const getCommunityOwnerId = async (communityId: string): APIResponse<string> => {
  try {
    const res = await api.get<string>(`/api/communities/ownerID?communityId=${communityId}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to fetch the banner of a community.
 * @returns  The banner URL or undefined if no banner exists.
 */
export const getCommunityBanner = async (communityId: string): APIResponse<string | undefined> => {
  try {
    const res = await api.get<string | undefined>(
      `/api/communities/banner?communityId=${communityId}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to fetch all community invites for the authenticated user.
 * @param auth - The authentication details of the user.
 * @returns An array of community invites.
 */
export const getMyInvites = async (auth: UserAuth): APIResponse<CommunityInvite[]> => {
  try {
    const res = await api.get<CommunityInvite[]>(
      `/api/communities/my-invites?${authToParams(auth)}`,
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to create a new invite for a user to join a community.
 * @param auth - The authentication details of the user sending the invite.
 * @param communityId - The ID of the community to invite the user to.
 * @param targetUsername - The username of the person being invited.
 * @returns The invite ID for the created invite.
 */
export const createInvite = async (
  auth: UserAuth,
  communityId: string,
  targetUsername: string,
): APIResponse<{ inviteId: string }> => {
  try {
    const res = await api.post<{ inviteId: string } | ErrorMsg>(`/api/communities/invite`, {
      auth,
      payload: { communityId, targetUsername },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to accept an invite to join a community.
 * @param auth - The authentication details of the user accepting the invite.
 * @param  inviteId - The ID of the invite to accept.
 * @returns - A success message indicating the invite was accepted.
 */
export const acceptInvite = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<{ success: true }> => {
  try {
    const res = await api.post<{ success: true } | ErrorMsg>(`/api/communities/invite/accept`, {
      auth,
      payload: { inviteId },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to decline an invite to join a community.
 * @param auth - The authentication details of the user declining the invite.
 * @param inviteId - The ID of the invite to decline.
 * @returns - A success message indicating the invite was declined.
 */
export const declineInvite = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<{ success: true }> => {
  try {
    const res = await api.post<{ success: true } | ErrorMsg>(`/api/communities/invite/decline`, {
      auth,
      payload: { inviteId },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to edit a community's details (name, description, banner).
 * @param auth - The authentication details of the user editing the community.
 * @param name - The new name for the community.
 * @param description - The new description for the community.
 * @param  banner - The new banner URL.
 * @param communityId - The ID of the community to edit.
 * @returns - The community ID of the updated community.
 */
export const editCommunity = async (
  auth: UserAuth,
  name: string,
  description: string | undefined,
  banner: string | undefined,
  communityId: string,
): APIResponse<{ communityId: string }> => {
  try {
    const res = await api.post<{ communityId: string } | ErrorMsg>(`/api/communities/edit`, {
      auth,
      payload: {
        communityId,
        name,
        description,
        banner,
      },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
