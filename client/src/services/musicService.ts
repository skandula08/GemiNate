import type { ErrorMsg, Playlist, Track } from "@gamenite/shared";
import type { APIResponse } from "../util/types";
import { api, exceptionToErrorMsg } from "./api";

/**
 * Sends a GET request to return the playlist of a community
 * @returns a promise for the given community's playlist
 */
export const getPlaylistByCommunityId = async (communityID: string): APIResponse<Playlist> => {
  try {
    const res = await api.get<Playlist>(`/api/playlist/community/${communityID}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to return the playlist of a community
 * @returns a promise for the given community's playlist
 */
export const getPlaylistById = async (playlistID: string): APIResponse<Playlist> => {
  try {
    const res = await api.get<Playlist>(`/api/playlist/${playlistID}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to create a playlist for a community
 * @returns promise resolving to the list of communities
 */
export const createPlaylistForCommunity = async (communityId: string): APIResponse<Playlist> => {
  try {
    const res = await api.post<Playlist | ErrorMsg>(`/api/playlist/create`, {
      communityId: communityId,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to search for songs in the soundcloud API based on a query
 * @returns a promise for list of tracks
 */
export const searchForMusic = async (query: string): APIResponse<Track[]> => {
  try {
    const res = await api.get<Track[]>(`/api/tracks/search`, {
      params: {
        q: query,
      },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to search for songs in the soundcloud API based on a query
 * @returns a promise for list of tracks
 */
export const addToPlaylist = async (track: Track, playlistID: string): APIResponse<Playlist> => {
  try {
    const res = await api.post<Playlist>(`/api/playlist/add/${playlistID}`, track);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to search for songs in the soundcloud API based on a query
 * @returns a promise for list of tracks
 */
export const deleteFromPlaylist = async (
  track: Track,
  playlistID: string,
): APIResponse<Playlist> => {
  try {
    const res = await api.post<Playlist>(`/api/playlist/delete/${playlistID}`, track);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to search for songs in the soundcloud API based on a query
 * @returns a promise for list of tracks
 */
export const moveTrackInPlaylist = async (
  track: Track,
  newIndex: number,
  playlistID: string,
): APIResponse<Playlist> => {
  try {
    const res = await api.post<Playlist>(`/api/playlist/move/${playlistID}`, {
      track: track,
      newIndex: newIndex,
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to search for songs in the soundcloud API based on a query
 * @returns a promise for list of tracks
 */
export const streamTrack = async (track: Track): APIResponse<Track> => {
  try {
    const res = await api.post<Track>(`/api/tracks/stream/`, {
      track,
    });

    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
