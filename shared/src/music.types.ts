/* eslint-disable @typescript-eslint/naming-convention */
import { z } from "zod";
import type { CommunityUser } from "./community.types.ts";

/**
 * Represents a Playlist
 */
export interface Playlist {
  title: string;
  playlistId: string;
  communityId: string;
  owner: CommunityUser;
  djList: CommunityUser[];
  tracks: Track[];
  duration: number;
}

/**
 * represents a sc auth token
 */
export type AuthToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: number;
};

/**
 * represents a track
 */
export type Track = {
  trackId: number;
  urn: string;
  title: string;
  artist: string | null;
  artwork: string;
  duration: number;
  streamUrl: string;
};

/**
 * represents the input for a track to the api
 */
export type TrackInput = z.infer<typeof zTrackInput>;
export const zTrackInput = z.object({
  trackId: z.number(),
  urn: z.string(),
  title: z.string(),
  artist: z.string().nullable(),
  artwork: z.string(),
  duration: z.number(),
  streamUrl: z.string(),
});

/**
 * represents the input to move a track
 */
export type MoveTrackInput = z.infer<typeof zMoveTrackInput>;
export const zMoveTrackInput = z.object({
  track: zTrackInput,
  newIndex: z.number(),
});

/**
 * represents a search query for sound cloud
 */
export type TrackSearch = {
  q?: string;
  urns?: string;
  genres?: string;
  tags?: string;
  limit?: number;
  access?: string[];
};

/**
 * represents a socket for the music player
 */
export const zMusicSocket = z.object({
  playlistId: z.string(),
});

/**
 * represents the current playback of the music player
 */
export type PlaybackState = {
  trackId: number;
  startedAt: number;
  isPlaying: boolean;
  pausedAt?: number;
  nextTrack: Track;
  loopMode?: "none" | "all" | "one";
};

/**
 * represents a search payload for the music feature
 */
export type SearchPayload = z.infer<typeof zSearchPayload>;
export const zSearchPayload = z.object({
  q: z.string().optional(),
  urns: z.string().optional(),
  genres: z.string().optional(),
  tags: z.string().optional(),
  limit: z.number().optional(),
  access: z.array(z.string()).optional(),
});

/**
 * represents a  payload for a new playlist
 */
export type NewPlaylistPayload = z.infer<typeof zNewPlaylistPayload>;
export const zNewPlaylistPayload = z.object({
  communityId: z.string(),
});

/**
 * represents the updates for a playlist
 */
export type PlaylistUpdatesPayload = z.infer<typeof zPlaylistUpdatesPayload>;
export const zPlaylistUpdatesPayload = z.object({
  title: z.string().optional(),
  playlistId: z.string(),
  communityId: z.string().optional(),
  owner: z
    .object({
      user: z.string(),
      role: z.enum(["dj", "owner", "kicked", "member", "banned"]),
    })
    .optional(),
  djList: z
    .array(
      z.object({
        user: z.string(),
        role: z.enum(["dj", "owner", "kicked", "member", "banned"]),
      }),
    )
    .optional(),
});

/**
 * represents a soundcloud song search result
 */
export interface SoundcloudTrack {
  comment_count: number;
  full_duration: number;
  downloadable: boolean;
  created_at: string;
  description: string | null;
  title: string;
  metadata_artist: string | null;
  duration: number;
  has_downloads_left: boolean;
  artwork_url: string;
  stream_url: string;
  public: boolean;
  streamable: boolean;
  tag_list: string;
  genre: string;
  id: number;
  reposts_count: number;
  state: "processing" | "failed" | "finished";
  label_name: string | null;
  last_modified: string;
  commentable: boolean;
  policy: string;
  visuals: string | null;
  kind: string;
  purchase_url: string | null;
  sharing: "private" | "public";
  uri: string;
  secret_token: string | null;
  download_count: number;
  likes_count: number;
  urn: string;
  purchase_title: string | null;
  display_date: string;
  embeddable_by: "all" | "me" | "none";
  release_date: string;
  user_id: number;
  monetization_model: string;
  waveform_url: string;
  permalink: string;
  permalink_url: string;
  playback_count: number;

  _resource_id?: number | null;
  _resource_type?: string | null;
  caption: string | null;
  playable?: boolean | null;
  station_urn?: string | null;
  station_permalink?: string | null;
  track_authorization?: string | null;
}

export type SoundcloudStreamLinks = {
  http_mp3_128_url: string;
  hls_mp3_128_url: string;
  hls_aac_160_url: string;
  http_mpreview_mp3_128_urlp3_128_url: string;
};
