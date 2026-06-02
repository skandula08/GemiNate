import { withAuth } from "@gamenite/shared";
import {
  zMoveTrackInput,
  zMusicSocket,
  zNewPlaylistPayload,
  zPlaylistUpdatesPayload,
  zSearchPayload,
  zTrackInput,
  type AuthToken,
  type PlaybackState,
  type Playlist,
  type Track,
  type TrackSearch,
} from "../../../shared/src/music.types.ts";
import type { PlaylistRecord } from "../models.ts";
import { PlaylistRepo } from "../repository.ts";
import {
  addTrackToPlaylist,
  createPlaylist,
  exchangeCodeForToken,
  getAllPlaylists,
  getPlaylistByCommunity,
  getTrackFromInput,
  getTrackStreamingLink,
  isDJ,
  moveTrackInPlaylist,
  populatePlaylistInfo,
  removeTrackFromPlaylist,
  searchForTracks,
  syncPlaylistRolesFromCommunity,
  updatePlaylistInformation,
} from "../services/music.service.ts";
import type { RestAPI, SocketAPI } from "../types.ts";
import { enforceAuth } from "../services/auth.service.ts";
import { logSocketError } from "./socket.controller.ts";
import { z } from "zod";
import { getIO } from "../io.ts";

/**
 * Handles redirecting to the authorization service and exchanges the code for an authentication token.
 * @returns The authentication token if successful.
 */
export const authorizeInRedirect: RestAPI<AuthToken> = async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send({ error: "Missing code or verifier" });
    return;
  }
  try {
    const tokenRes: AuthToken = await exchangeCodeForToken(code);
    res.send(tokenRes);
  } catch {
    res.status(500).send({ error: "No Success!" });
  }
};

/**
 * Creates a new playlist based on the provided data.
 * @returns The created playlist.
 */
export const postCreatePlaylist: RestAPI<Playlist> = async (req, res) => {
  const payload = zNewPlaylistPayload.safeParse(req.body);
  if (!payload.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const input = payload.data;
  const playlist = await createPlaylist(input.communityId, new Date());
  res.send(playlist);
};

/**
 * Fetches the playlist for a given community.
 * @returns The playlist for the specified community.
 */
export const getCommunityPlaylist: RestAPI<Playlist> = async (req, res) => {
  const { communityId } = req.params;
  try {
    // Sync playlist roles from the community so stale owner/djList data is corrected on load
    await syncPlaylistRolesFromCommunity(communityId);
    const playlist: Playlist = await getPlaylistByCommunity(communityId);
    res.send(playlist);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch playlists" });
  }
};

/**
 * Adds a track to the specified playlist.
 * @returns The updated playlist with the new track.
 */
export const addTrack: RestAPI<Playlist> = async (req, res) => {
  const playlistID = req.params.playlistID;
  const payload = zTrackInput.safeParse(req.body);
  if (!payload.success) {
    res.status(400).send({ error: "Missing track object" });
    return;
  }

  try {
    const updatedPlaylist: Playlist = await addTrackToPlaylist(playlistID, payload.data);

    const io = getIO();
    io.to(playlistID).emit("musicPlaylistUpdate", { playlist: updatedPlaylist });

    // Auto-play if the playlist was idle (no active playback state)
    if (!playbackStore.has(playlistID) && updatedPlaylist.tracks.length === 1) {
      const track = updatedPlaylist.tracks[0];
      const state: PlaybackState = {
        trackId: track.trackId,
        startedAt: Date.now(),
        isPlaying: true,
        nextTrack: updatedPlaylist.tracks[1] ?? track,
      };
      playbackStore.set(playlistID, state);
      io.to(playlistID).emit("musicPlaybackUpdate", { playlistId: playlistID, state });
    }

    res.send(updatedPlaylist);
  } catch (err) {
    res.status(500).send({ error: "Failed to add song!" });
  }
};
/**
 * Deletes a track from the specified playlist.
 * @returns The updated playlist after the track is removed.
 */
// --- REMOVE TRACK ---
export const deleteTrack: RestAPI<Playlist> = async (req, res) => {
  const { playlistID } = req.params;
  const payload = zTrackInput.safeParse(req.body);
  if (!payload.success) {
    res.status(400).send({ error: "Missing track object" });
    return;
  }
  const track: Track = { ...payload.data };
  try {
    const updatedPlaylist = await removeTrackFromPlaylist(playlistID, track);
    getIO().to(playlistID).emit("musicPlaylistUpdate", { playlist: updatedPlaylist });
    res.send(updatedPlaylist);
  } catch (err) {
    res.status(500).send({ error: "Couldn't delete track" });
  }
};

/**
 * Moves a track within the playlist to a new index.
 * @returns The updated playlist after the track is moved.
 */
// --- MOVE TRACK ---
export const moveTrack: RestAPI<Playlist> = async (req, res) => {
  const playlistID = req.params.playlistID;
  const parsed = zMoveTrackInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send({ error: "Missing newIndex in body" });
    return;
  }
  const { track, newIndex } = parsed.data;
  try {
    const updatedPlaylist = await moveTrackInPlaylist(playlistID, track.trackId, newIndex);
    getIO().to(playlistID).emit("musicPlaylistUpdate", { playlist: updatedPlaylist });
    res.send(updatedPlaylist);
  } catch (err) {
    res.status(500).send({ error: "couldnt move track" });
  }
};

/**
 * Fetches a playlist by its ID.
 * @returns The playlist for the specified ID.
 */
export const getPlaylistById: RestAPI<Playlist> = async (req, res) => {
  const playlistID = req.params.playlistID;

  if (!playlistID) {
    res.status(400).send({ error: "Missing playlistId in URL" });
    return;
  }
  try {
    const playlistRecord: PlaylistRecord | null = await PlaylistRepo.find(playlistID);

    if (!playlistRecord) {
      res.status(404).send({ error: "Playlist not found" });
      return;
    }
    // Use your helper to format the playlist object for API response
    const playlist = await populatePlaylistInfo(playlistID);
    res.status(200).send(playlist);
  } catch (err) {
    // console.error(err);
    res.status(500).send({ error: "Failed to fetch playlist" });
  }
};

/**
 * Fetches all playlists.
 * @returns A list of all playlists.
 */
export const getAllPlaylistsCon: RestAPI<Playlist[]> = async (req, res) => {
  try {
    const playlists = await getAllPlaylists();
    res.status(200).send(playlists);
    return;
  } catch (error) {
    // console.error("Error fetching all playlists:", error);
    res.status(500).send({ error: "Failed to fetch playlist" });
  }
};

/**
 * Searches for tracks based on a query.
 * @returns A list of tracks matching the search query.
 */
export const searchTracks: RestAPI<Track[]> = async (req, res) => {
  const queryObj = { q: req.query["q"], limit: 10, access: ["playable"] };

  const params = zSearchPayload.safeParse(queryObj);
  if (!params.success) {
    res.status(404).send({ error: "improper search parameters" });
    return;
  }

  const searchparams: TrackSearch = { ...params.data };
  try {
    const searchResults = await searchForTracks(searchparams);
    res.status(200).send(searchResults);
    return;
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch search results" });
  }
};

/**
 * Streams a track based on the provided input.
 * @returns The streaming link for the requested track.
 */
export const streamTrack: RestAPI = async (req, res) => {
  const payload = zTrackInput.safeParse(req.body);
  if (!payload.success) {
    res.status(404).send({ error: "improper search parameters" });
    return;
  }
  try {
    const track: Track = getTrackFromInput({ ...payload.data });
    const stream = await getTrackStreamingLink(track);
    res.send(stream);
  } catch (err) {
    res.status(500).send({ error: "Failed to stream track" });
  }
};

/**
 * Updates the information of an existing playlist.
 * @returns The updated playlist.
 */
export const updatePlaylistInfo: RestAPI<Playlist> = async (req, res) => {
  const payload = zPlaylistUpdatesPayload.safeParse(req.body);
  if (!payload.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const input = payload.data;
  const playlist = await updatePlaylistInformation(input);
  res.send(playlist);
};

const playbackStore = new Map<string, PlaybackState>();

/**
 * Joins a playlist's music stream via socket.
 * @returns A response with the current playback state or null if no state.
 */
export const musicJoin: SocketAPI = (socket, io) => async (body) => {
  try {
    const { payload } = withAuth(zMusicSocket).parse(body);
    const { playlistId } = payload;
    await socket.join(playlistId);
    const state = playbackStore.get(playlistId);
    socket.emit("joinedMusicStream", { playlistId, state: state ?? null });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Starts playing a track in a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const socketPlayMusic: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({
        playlistId: z.string(),
        track: zTrackInput,
      }),
    ).parse(body);

    const user = await enforceAuth(auth);

    const playlist = await PlaylistRepo.find(payload.playlistId);
    if (!playlist) return;

    if (!(await isDJ(user.userId, payload.playlistId))) {
      return;
    }

    const currentIndex = playlist.tracks.findIndex((t) => t.trackId === payload.track.trackId);

    if (currentIndex === -1) return;

    const nextIndex = currentIndex < playlist.tracks.length - 1 ? currentIndex + 1 : 0; // loop to start
    const nextTrack = playlist.tracks[nextIndex];

    const state: PlaybackState = {
      trackId: payload.track.trackId,
      startedAt: Date.now(),
      isPlaying: true,
      nextTrack,
    };

    playbackStore.set(payload.playlistId, state);

    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Pauses the current music playback in a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicPause: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);

    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const state = playbackStore.get(payload.playlistId);
    if (!state) return;

    state.isPlaying = false;
    state.pausedAt = Date.now();

    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Resumes the current music playback in a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicResume: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);

    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const state = playbackStore.get(payload.playlistId);

    // No playback state yet — bootstrap from the first track in the playlist
    if (!state) {
      const playlist = await PlaylistRepo.get(payload.playlistId);
      if (!playlist || playlist.tracks.length === 0) return;
      const firstTrack = playlist.tracks[0];
      const newState: PlaybackState = {
        trackId: firstTrack.trackId,
        startedAt: Date.now(),
        isPlaying: true,
        nextTrack: playlist.tracks[1] ?? firstTrack,
      };
      playbackStore.set(payload.playlistId, newState);
      io.to(payload.playlistId).emit("musicPlaybackUpdate", {
        playlistId: payload.playlistId,
        state: newState,
      });
      return;
    }

    if (!state.pausedAt) return; // Already playing

    const pausedDuration = Date.now() - state.pausedAt;

    state.startedAt += pausedDuration;
    state.isPlaying = true;
    state.pausedAt = undefined;

    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Restarts the current track in a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicRestartTrack: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);
    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const state = playbackStore.get(payload.playlistId);
    if (!state) return;

    state.startedAt = Date.now();
    state.isPlaying = true;
    delete state.pausedAt;

    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Moves to the previous track in a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicPrevTrack: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);
    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const playlist = await PlaylistRepo.get(payload.playlistId);
    if (!playlist || playlist.tracks.length === 0) return;

    const state = playbackStore.get(payload.playlistId);
    if (!state) return;

    const currentIndex = playlist.tracks.findIndex((t) => t.trackId === state.trackId);
    const prevIndex = currentIndex <= 0 ? playlist.tracks.length - 1 : currentIndex - 1;
    const nextTrackIndex = (prevIndex + 1) % playlist.tracks.length;

    const newState: PlaybackState = {
      ...state,
      trackId: playlist.tracks[prevIndex].trackId,
      startedAt: Date.now(),
      isPlaying: true,
      nextTrack: playlist.tracks[nextTrackIndex],
    };
    delete newState.pausedAt;

    playbackStore.set(payload.playlistId, newState);
    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state: newState,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Seeks to a specific position in the current track of a playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicSeek: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({
        playlistId: z.string(),
        positionMs: z.number().nonnegative(),
      }),
    ).parse(body);
    const user = await enforceAuth(auth);
    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const state = playbackStore.get(payload.playlistId);
    if (!state) return;

    state.startedAt = Date.now() - payload.positionMs;
    delete state.pausedAt;

    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Sets the loop mode for the playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicSetLoopMode: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({
        playlistId: z.string(),
        loopMode: z.enum(["none", "all", "one"]),
      }),
    ).parse(body);
    const user = await enforceAuth(auth);
    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const state = playbackStore.get(payload.playlistId);
    if (!state) return;

    state.loopMode = payload.loopMode;
    io.to(payload.playlistId).emit("musicPlaybackUpdate", {
      playlistId: payload.playlistId,
      state,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Plays the next track in the playlist via socket.
 * @returns A response with the updated playback state.
 */
export const musicPlayNextTrack: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);
    const { playlistId } = payload;

    if (!(await isDJ(user.userId, playlistId))) return;

    const state = playbackStore.get(playlistId);
    if (!state) return;

    const playlist = await PlaylistRepo.get(playlistId);
    if (!playlist) return;

    const loopMode = state.loopMode ?? "none";
    const currentTrackIndex = playlist.tracks.findIndex((t) => t.trackId === state.trackId);

    if (loopMode === "one") {
      const currentTrack = playlist.tracks[currentTrackIndex];
      if (!currentTrack) return;
      const newState: PlaybackState = {
        ...state,
        trackId: currentTrack.trackId,
        startedAt: Date.now(),
        isPlaying: true,
        nextTrack: currentTrack,
      };
      delete newState.pausedAt;
      playbackStore.set(playlistId, newState);
      io.to(playlistId).emit("musicPlaybackUpdate", { playlistId, state: newState });
      return;
    }

    if (playlist.tracks.length <= 1) return;

    const isLastTrack = currentTrackIndex === playlist.tracks.length - 1;

    if (loopMode === "none" && isLastTrack) {
      const newState: PlaybackState = { ...state, isPlaying: false };
      delete newState.pausedAt;
      playbackStore.set(playlistId, newState);
      io.to(playlistId).emit("musicPlaybackUpdate", { playlistId, state: newState });
      return;
    }

    // loopMode === 'all', or loopMode === 'none' mid-queue
    const nextIndex = currentTrackIndex + 1 < playlist.tracks.length ? currentTrackIndex + 1 : 0;
    const nextTrack = playlist.tracks[nextIndex];
    const afterNextIndex = nextIndex + 1 < playlist.tracks.length ? nextIndex + 1 : 0;
    const newState: PlaybackState = {
      ...state,
      trackId: nextTrack.trackId,
      startedAt: Date.now(),
      isPlaying: true,
      nextTrack: playlist.tracks[afterNextIndex] ?? playlist.tracks[0],
    };
    delete newState.pausedAt;
    playbackStore.set(playlistId, newState);
    io.to(playlistId).emit("musicPlaybackUpdate", { playlistId, state: newState });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Shuffles the tracks in the playlist via socket.
 * @returns A response with the shuffled playlist and updated playback state.
 */
export const musicShuffle: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(zMusicSocket).parse(body);
    const user = await enforceAuth(auth);
    if (!(await isDJ(user.userId, payload.playlistId))) return;

    const playlist = await PlaylistRepo.get(payload.playlistId);
    if (!playlist || playlist.tracks.length <= 1) return;

    // Fisher-Yates shuffle on a copy
    const tracks = [...playlist.tracks];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    await PlaylistRepo.set(payload.playlistId, { ...playlist, tracks });

    const updatedPlaylist = await populatePlaylistInfo(payload.playlistId);
    io.to(payload.playlistId).emit("musicPlaylistUpdate", { playlist: updatedPlaylist });

    // Update nextTrack in PlaybackState to reflect new order
    const state = playbackStore.get(payload.playlistId);
    if (state) {
      const currentIndex = tracks.findIndex((t) => t.trackId === state.trackId);
      const nextIndex =
        currentIndex >= 0 && currentIndex + 1 < tracks.length ? currentIndex + 1 : 0;
      state.nextTrack = tracks[nextIndex];
      io.to(payload.playlistId).emit("musicPlaybackUpdate", {
        playlistId: payload.playlistId,
        state,
      });
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};
