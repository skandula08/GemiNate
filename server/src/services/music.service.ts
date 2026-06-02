/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  type AuthToken,
  type Playlist,
  type PlaylistUpdatesPayload,
  type SoundcloudStreamLinks,
  type SoundcloudTrack,
  type Track,
  type TrackInput,
  type TrackSearch,
} from "../../../shared/src/music.types.ts";
import "dotenv/config";
import { CommunityRepo, PlaylistRepo, PlaylistByCommunityIndex } from "../repository.ts";
import { populateSafeUserInfo } from "./user.service.ts";

const BASE_URL = "https://api.soundcloud.com/";
const AUTH_URL = "https://secure.soundcloud.com/oauth/token";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CODE_CHALLENGE = process.env.CODE_CHALLENGE;
const CODE_VERIFIER = process.env.CODE_VERIFIER;
const REDIRECT = process.env.REDIRECT_URL;
const STATE = process.env.STATE;

interface StoredToken extends AuthToken {
  expires_at: number;
}

let token: StoredToken | null = null;

export function getAuthenticationURL() {
  const authUrl =
    `https://secure.soundcloud.com/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${REDIRECT}` +
    `&response_type=code` +
    `&code_challenge=${CODE_CHALLENGE}` +
    `&code_challenge_method=S256` +
    `&state=${STATE}`;
  return authUrl;
}

/**
 * Generates the SoundCloud authentication URL to initiate the OAuth flow.
 * @returns {string} The URL for authentication.
 */
export async function exchangeCodeForToken(code: string) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: String(CLIENT_ID),
      client_secret: String(CLIENT_SECRET),
      redirect_uri: String(REDIRECT),
      code_verifier: String(CODE_VERIFIER),
      code: String(code),
    }),
  });
  const data: AuthToken = (await res.json()) as AuthToken;
  token = {
    ...data,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data;
}

/**
 * Retrieves the current access token, refreshing it if necessary.
 * @returns The current access token.
 */
export async function refreshAuthToken(prevToken: AuthToken) {
  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `${prevToken.token_type} ${prevToken.access_token}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: prevToken.refresh_token,
      client_id: String(CLIENT_ID),
      client_secret: String(CLIENT_SECRET),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }
  const data = (await response.json()) as AuthToken;
  token = {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
    refresh_token: data.refresh_token || String(token?.refresh_token),
    expires_in: data.expires_in,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  console.log("🔄 Token refreshed:", token);
}

export async function getAccessToken(): Promise<AuthToken> {
  if (!token) {
    const clientCredentials = await credentialsFlow(CLIENT_ID as string, CLIENT_SECRET as string);
    console.log("beginning with client creds flow");
    //   const clientCredentials: AuthToken = {
    //  "access_token": "eyJraWQiOiJzYy01d19yME13IiwidHlwIjoiYXQrSldUIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJzb3VuZGNsb3VkOnVzZXJzOjEyNzYwODk5NTgiLCJhdWQiOiJodHRwczovL3NvdW5kY2xvdWQuY29tIiwic2NvcGUiOiIiLCJpc3MiOiJodHRwczovL3NlY3VyZS5zb3VuZGNsb3VkLmNvbSIsImNhaSI6IjMyNzA0MSIsImV4cCI6MTc3NDU0MDI2MSwiaWF0IjoxNzc0NTM2NjYxLCJqdGkiOiIwZjY3ZTUwYS04NGQ4LTQ3ZmYtYjQ3Mi02ZWE4MTA5MzY5M2YiLCJjbGllbnRfaWQiOiIzVG9nc2pVak5LSjc1RFpVclZoUzg0RVdPNGhqSXBzNyIsInNpZCI6IjAxS01OQTE2R1ZFNjI5TUI0TlNKVFFXUzdHIn0.zAj_hWd_z0hVWyat1tbRN7DgaGJqCjZ53iCOE6009uzBsdM2t48iYCHnxGYHYsLh9r51r0sKFYHlQB6Brkx7BhX1zRZ8GEe5_KWITp9PR2CNMODEE4DvbEgTZkaarg5YG_CWpKM6pEgd219_wySQQIra1zZ3IolODL2wfK-bZOG2XXsAajvCkcG5h1QliAdZaJwPvVlEkXzmIcfyzNaZL-1q9x04ymJYSqjr7oh-y0xQSre6_zj-TIPhMaL-y4MUspjoamyTYqOP0JHZ79YilO78xAupRo0aM19sKHZy-2MHPscq7vf7U33Y1vurVyUY7OKWhe2WulQRiTSPp1xRpw",
    // "token_type": "Bearer",
    // "expires_in": 3599,
    // "refresh_token": "rJj8ze5LWUzCY32hy4JKOy4uf909gFQJ",
    //     scope: 0,
    //   };
    token = { ...clientCredentials, expires_at: Date.now() + clientCredentials.expires_in * 1000 };
  }

  // Refresh slightly before expiry
  if (Date.now() > token.expires_at - 30_000) {
    await refreshAuthToken(token);
  }

  return token;
}
/**
 * Handles the client credentials flow to get an initial token.
 * @param  clientID - The SoundCloud client ID.
 * @param clientSecret - The SoundCloud client secret.
 * @returns The access token.
 */
export async function credentialsFlow(clientID: string, clientSecret: string) {
  const credentials = btoa(`${clientID}:${clientSecret}`);
  const authHeader = `Basic ${credentials}`;
  const requestBody = new URLSearchParams();
  requestBody.append("grant_type", "client_credentials");

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST", // Standard is POST, not PUT
      headers: {
        accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        authorization: authHeader,
      },
      body: requestBody.toString(),
    });

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`HTTP Error! Status: ${res.status} - ${errorData}`);
    }
    const data: AuthToken = (await res.json()) as AuthToken;
    token = {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    return data;
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
}
/**
 * Searches for tracks on SoundCloud based on given search parameters.
 * @param  searchInput - The search criteria (e.g., title, artist).
 * @returns  A list of tracks that match the search criteria.
 */
export async function searchForTracks(searchInput: TrackSearch) {
  const params = new URLSearchParams("");
  Object.entries(searchInput).map(([key, value]) => {
    params.append(key, String(value));
  });
  const url = `${BASE_URL}tracks?${params}`;
  const accesor = await getAccessToken();
  console.log(url);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
      authorization: ` ${accesor.token_type} ${accesor.access_token}`,
    },
  });
  const data = (await res.json()) as SoundcloudTrack[];
  const searchResults = data.map((track) => {
    return {
      trackId: track.id,
      urn: track.urn,
      title: track.title,
      artist: track.metadata_artist,
      artwork: track.artwork_url,
      duration: track.duration,
      streamUrl: track.stream_url,
    };
  });
  return searchResults;
}

/**
 * Searches for tracks on SoundCloud based on given search parameters.
 * @param searchInput - The search criteria (e.g., title, artist).
 * @returns  A list of tracks that match the search criteria.
 */
export async function getTrackStreamingLink(track: Track) {
  const url = `${BASE_URL}tracks/${track.trackId}/streams`;
  const authToken = await getAccessToken();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json; charset=utf-8",
      authorization: `${authToken.token_type} ${authToken.access_token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch streams for track ${track.trackId}: ${res.status}`);
  }
  const data = (await res.json()) as SoundcloudStreamLinks;
  if (!data.http_mp3_128_url) {
    throw new Error(`No streamable URL for track ${track.trackId}`);
  }
  // Follow the redirect server-side so the browser gets a pre-signed CDN URL
  // it can load without attaching an OAuth header (audio.src cannot set headers).
  const cdnRes = await fetch(data.http_mp3_128_url, {
    headers: { authorization: `${authToken.token_type} ${authToken.access_token}` },
  });
  return cdnRes.url;
}

/**
 * Expand a stored game
 *
 * @param gameId - Valid playlist id
 * @returns the expanded playlist object
 */
export async function populatePlaylistInfo(playlistId: string): Promise<Playlist> {
  const playlist = await PlaylistRepo.get(playlistId);
  const owner = {
    user: await populateSafeUserInfo(playlist.owner.userId),
    role: playlist.owner.role,
  };
  const djs = await Promise.all(
    playlist.djList.map(async (dj) => {
      return {
        user: await populateSafeUserInfo(dj.userId),
        role: dj.role,
      };
    }),
  );
  return {
    playlistId,
    title: playlist.title,
    communityId: playlist.communityId,
    owner: owner,
    djList: djs,
    tracks: playlist.tracks,
    duration: playlist.duration,
  };
}

/**
 * Create and store a new game
 *
 * @param user - Initial player in the game's waiting room
 * @param type - Game key
 * @param createdAt - Creation time for this game
 * @returns the new game's info object
 */
export async function createPlaylist(
  // djs: SafeUserInfo[],
  communityId: string,
  createdAt: Date,
): Promise<Playlist> {
  const community = await CommunityRepo.get(communityId);
  const owner = community.participants.filter((f) => f.role === "owner")[0];
  const djList = community.participants.filter((f) => f.role === "dj");
  const playlistId = await PlaylistRepo.add({
    title: community.name || "",
    communityId: communityId,
    owner: owner,
    djList: djList,
    tracks: [],
    duration: 0,
    createdAt: createdAt,
  });

  // Maintain the communityId → playlistId index
  await PlaylistByCommunityIndex.set(communityId, playlistId);

  return populatePlaylistInfo(playlistId);
}
/**
 * Add a track to a playlist
 */
export async function addTrackToPlaylist(playlistId: string, track: TrackInput): Promise<Playlist> {
  const playlist = await PlaylistRepo.get(playlistId);
  if (!playlist) throw new Error("Playlist not found");

  // Add track
  playlist.tracks.push(getTrackFromInput(track));
  playlist.duration += track.duration;

  // Update repo
  await PlaylistRepo.set(playlistId, {
    ...playlist,
    tracks: playlist.tracks,
    duration: playlist.duration,
  });

  return populatePlaylistInfo(playlistId);
}

export function getTrackFromInput(input: TrackInput): Track {
  return {
    title: input.title,
    trackId: input.trackId,
    duration: input.duration,
    streamUrl: input.streamUrl,
    artist: input.artist,
    artwork: input.artwork,
    urn: input.urn,
  };
}

/**
 * Remove a track from a playlist
 */
export async function removeTrackFromPlaylist(playlistId: string, track: Track): Promise<Playlist> {
  const playlist = await PlaylistRepo.get(playlistId);
  if (!playlist) throw new Error("Playlist not found");

  const index = playlist.tracks.findIndex((t) => t.trackId === track.trackId);
  if (index === -1) throw new Error("Track not found in playlist");

  const [removedTrack] = playlist.tracks.splice(index, 1);
  playlist.duration -= removedTrack.duration;

  await PlaylistRepo.set(playlistId, {
    ...playlist,
    tracks: playlist.tracks,
    duration: playlist.duration,
  });

  return populatePlaylistInfo(playlistId);
}

/**
 * Move a track to a new index inside a playlist
 */
export async function moveTrackInPlaylist(
  playlistId: string,
  trackId: number,
  newIndex: number,
): Promise<Playlist> {
  const playlist = await PlaylistRepo.get(playlistId);
  if (!playlist) throw new Error("Playlist not found");

  const oldIndex = playlist.tracks.findIndex((t) => t.trackId === trackId);
  if (oldIndex === -1) throw new Error("Track not found in playlist");

  // Remove track
  const [track] = playlist.tracks.splice(oldIndex, 1);

  const clampedIndex = Math.max(0, Math.min(newIndex, playlist.tracks.length));

  // Insert at new index
  playlist.tracks.splice(clampedIndex, 0, track);

  await PlaylistRepo.set(playlistId, { ...playlist, tracks: playlist.tracks });

  return populatePlaylistInfo(playlistId);
}

export async function getPlaylistByCommunity(communityId: string): Promise<Playlist> {
  // O(1) lookup via the secondary index instead of scanning all playlists
  const playlistId = await PlaylistByCommunityIndex.find(communityId);
  if (!playlistId) throw new Error(`No playlist found for communityId: ${communityId}`);

  return populatePlaylistInfo(playlistId);
}

/**
 * Get all playlists in the repository, fully populated
 */
export async function getAllPlaylists(): Promise<Playlist[]> {
  // Get all keys in the repo
  const allKeys = await PlaylistRepo.getAllKeys();

  // Map each key to a populated Playlist
  const playlists: Playlist[] = [];
  for (const key of allKeys) {
    try {
      const playlist = await populatePlaylistInfo(key);
      playlists.push(playlist);
    } catch (e) {
      console.warn(`Skipping key ${key}:`, e);
    }
  }

  return playlists;
}

export async function updatePlaylistInformation(payload: PlaylistUpdatesPayload) {
  const updatedPlaylist = await PlaylistRepo.get(payload.playlistId);
  if (payload.title !== undefined) {
    updatedPlaylist.title = payload.title;
  }

  if (payload.owner !== undefined) {
    updatedPlaylist.owner = {
      userId: payload.owner.user,
      role: payload.owner.role,
    };
  }
  if (payload.djList !== undefined) {
    updatedPlaylist.djList = payload.djList.map((dj) => ({
      userId: dj.user,
      role: dj.role,
    }));
  }
  await PlaylistRepo.set(payload.playlistId, updatedPlaylist);
  return await populatePlaylistInfo(payload.playlistId);
}

/**
 * Sync playlist owner and djList from the current community participants.
 * Called whenever community roles change (set role, transfer ownership, etc.)
 */
export async function syncPlaylistRolesFromCommunity(communityId: string) {
  const community = await CommunityRepo.get(communityId);

  // O(1) lookup via the secondary index instead of scanning all playlists
  const playlistId = await PlaylistByCommunityIndex.find(communityId);
  if (!playlistId) return; // No playlist for this community yet

  const playlist = await PlaylistRepo.get(playlistId);

  const newOwner = community.participants.find((p) => p.role === "owner");
  if (newOwner) {
    playlist.owner = { userId: newOwner.userId, role: newOwner.role };
  }
  playlist.djList = community.participants.filter((p) => p.role === "dj");

  await PlaylistRepo.set(playlistId, playlist);
  return await populatePlaylistInfo(playlistId);
}

export async function isDJ(userId: string, playlistId: string) {
  const playlist = await PlaylistRepo.get(playlistId);
  return playlist.owner.userId === userId || playlist.djList.some((dj) => dj.userId === userId);
}
