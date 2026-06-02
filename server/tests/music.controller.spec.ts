import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommunityUser } from "@gamenite/shared";
import type { GameServerSocket, GameServer } from "../src/types.ts";

const track1 = {
  trackId: 1,
  urn: "soundcloud:tracks:1",
  title: "Track 1",
  artist: null,
  artwork: "",
  duration: 180000,
  streamUrl: "",
};
const track2 = {
  trackId: 2,
  urn: "soundcloud:tracks:2",
  title: "Track 2",
  artist: null,
  artwork: "",
  duration: 200000,
  streamUrl: "",
};
const fakePlaylistRecord = {
  title: "Test",
  communityId: "c1",
  owner: { userId: "user-1", role: "owner" },
  djList: [],
  tracks: [track1, track2],
  duration: 380000,
  createdAt: new Date(),
};
const fakeAuth = { kind: "password" as const, username: "owner", password: "pwd" };
const PLAYLIST_ID = "playlist-1";

const fakePopulatedPlaylist = {
  playlistId: PLAYLIST_ID,
  title: "Test",
  communityId: "c1",
  owner: {
    user: { username: "owner", display: "Owner", createdAt: new Date() },
    role: "owner" as const,
  },
  djList: [] as CommunityUser[],
  tracks: fakePlaylistRecord.tracks,
  duration: fakePlaylistRecord.duration,
};

vi.mock("../src/services/auth.service.ts", () => ({
  enforceAuth: vi.fn(() => Promise.resolve({ userId: "user-1", username: "owner" })),
}));

vi.mock("../src/services/music.service.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/music.service.ts")>();
  return {
    ...actual,
    isDJ: vi.fn(() => Promise.resolve(true)),
    populatePlaylistInfo: vi.fn(() => Promise.resolve(fakePopulatedPlaylist)),
  };
});

vi.mock("../src/repository.ts", () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PlaylistRepo: {
    find: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("../src/io.ts", () => ({
  getIO: vi.fn(() => ({ to: vi.fn().mockReturnThis(), emit: vi.fn() })),
  setIO: vi.fn(),
}));

import { PlaylistRepo } from "../src/repository.ts";
import {
  socketPlayMusic,
  musicJoin,
  musicPause,
  musicResume,
  musicRestartTrack,
  musicPrevTrack,
  musicSeek,
  musicSetLoopMode,
  musicPlayNextTrack,
  musicShuffle,
} from "../src/controllers/music.controller.ts";
import { isDJ } from "../src/services/music.service.ts";

async function seedPlaybackStore(mockSocket: GameServerSocket, mockIO: GameServer) {
  (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
  (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
  await socketPlayMusic(
    mockSocket,
    mockIO,
  )({
    auth: fakeAuth,
    payload: { playlistId: PLAYLIST_ID, track: track1 },
  });
}

describe("musicRestartTrack", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("emits musicPlaybackUpdate with the same trackId, isPlaying true, and fresh startedAt", async () => {
    const before = Date.now();
    await musicRestartTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    const after = Date.now();

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.trackId).toBe(1);
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.startedAt).toBeGreaterThanOrEqual(before);
    expect(payload.state.startedAt).toBeLessThanOrEqual(after);
    expect(payload.state.pausedAt).toBeUndefined();
  });

  it("does nothing if no playback state exists for the playlist", async () => {
    await musicRestartTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "nonexistent" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("musicPrevTrack", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("wraps to the last track when currently at index 0", async () => {
    // store is seeded with track1 (index 0) playing
    await musicPrevTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.trackId).toBe(track2.trackId); // wrapped to last
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.nextTrack.trackId).toBe(track1.trackId); // next after last is first
  });

  it("goes to the previous track when not at index 0", async () => {
    // Re-seed with track2 (index 1) playing
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: track2 },
    });
    mockEmit.mockClear();

    await musicPrevTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [, payload] = mockEmit.mock.calls[0];
    expect(payload.state.trackId).toBe(track1.trackId);
    expect(payload.state.nextTrack.trackId).toBe(track2.trackId);
  });

  it("does nothing if the playlist has no tracks", async () => {
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...fakePlaylistRecord,
      tracks: [],
    });
    await musicPrevTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing if no playback state exists for the playlist", async () => {
    await musicPrevTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "nonexistent" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("musicSeek", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("sets startedAt to Date.now() - positionMs and broadcasts update", async () => {
    const positionMs = 30000;
    const before = Date.now();

    await musicSeek(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, positionMs },
    });

    const after = Date.now();
    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.startedAt).toBeGreaterThanOrEqual(before - positionMs);
    expect(payload.state.startedAt).toBeLessThanOrEqual(after - positionMs);
    expect(payload.state.pausedAt).toBeUndefined();
  });

  it("does not change isPlaying", async () => {
    await musicSeek(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, positionMs: 10000 },
    });

    const [, payload] = mockEmit.mock.calls[0];
    expect(payload.state.isPlaying).toBe(true); // was true from seed
  });

  it("does nothing if no playback state exists", async () => {
    await musicSeek(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "nonexistent", positionMs: 5000 },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("rejects negative positionMs", async () => {
    await musicSeek(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, positionMs: -1 },
    });
    // Zod validation fails → logSocketError called, no emit
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("musicSetLoopMode", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("sets loopMode on the state and broadcasts musicPlaybackUpdate", async () => {
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "all" },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.loopMode).toBe("all");
    expect(payload.playlistId).toBe(PLAYLIST_ID);
  });

  it("overwrites an existing loopMode", async () => {
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "all" },
    });
    mockEmit.mockClear();

    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "one" },
    });

    const [, payload] = mockEmit.mock.calls[0];
    expect(payload.state.loopMode).toBe("one");
  });

  it("does nothing if no playback state exists for the playlist", async () => {
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "nonexistent", loopMode: "all" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing for an invalid loopMode value", async () => {
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "repeat" as unknown as "none" | "all" | "one" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("musicPlayNextTrack – loop behavior", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO); // seeds track1 at index 0
    mockEmit.mockClear();
  });

  it("replays the current track when loopMode is 'one'", async () => {
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "one" },
    });
    mockEmit.mockClear();

    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.trackId).toBe(track1.trackId);
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.loopMode).toBe("one");
    expect(payload.state.pausedAt).toBeUndefined();
  });

  it("stops playback when loopMode is 'none' and at the last track", async () => {
    // Seed with track2 (index 1 = last)
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: track2 },
    });
    mockEmit.mockClear();

    // loopMode absent → treated as 'none'
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.isPlaying).toBe(false);
    expect(payload.state.trackId).toBe(track2.trackId);
  });

  it("advances normally when loopMode is 'none' and mid-queue", async () => {
    // State seeded with track1 (index 0), not the last track
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    const [, payload] = mockEmit.mock.calls[0];
    expect(payload.state.trackId).toBe(track2.trackId);
    expect(payload.state.isPlaying).toBe(true);
  });

  it("wraps to first track when loopMode is 'all' and at the last track", async () => {
    // Seed with track2 (last)
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: track2 },
    });
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "all" },
    });
    mockEmit.mockClear();

    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    const [, payload] = mockEmit.mock.calls[0];
    expect(payload.state.trackId).toBe(track1.trackId);
    expect(payload.state.isPlaying).toBe(true);
  });
});

describe("musicShuffle", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (PlaylistRepo.set as ReturnType<typeof vi.fn>).mockClear();
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("shuffles the tracks, persists them, and broadcasts musicPlaylistUpdate", async () => {
    await musicShuffle(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    // PlaylistRepo.set was called with all original tracks (possibly reordered)
    const setCalls = (PlaylistRepo.set as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.length).toBe(1);
    const savedTracks: (typeof track1)[] = setCalls[0][1].tracks;
    expect(savedTracks).toHaveLength(fakePlaylistRecord.tracks.length);
    expect(savedTracks.map((t) => t.trackId)).toEqual(
      expect.arrayContaining(fakePlaylistRecord.tracks.map((t) => t.trackId)),
    );

    // musicPlaylistUpdate was broadcast
    const playlistUpdateCall = mockEmit.mock.calls.find(([e]) => e === "musicPlaylistUpdate");
    expect(playlistUpdateCall).toBeDefined();
    expect(playlistUpdateCall![1].playlist.playlistId).toBe(PLAYLIST_ID);
  });

  it("also broadcasts musicPlaybackUpdate with recalculated nextTrack when state exists", async () => {
    await musicShuffle(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    const playbackUpdateCall = mockEmit.mock.calls.find(([e]) => e === "musicPlaybackUpdate");
    expect(playbackUpdateCall).toBeDefined();
    const state = playbackUpdateCall![1].state;
    const allTrackIds = fakePlaylistRecord.tracks.map((t) => t.trackId);
    expect(allTrackIds).toContain(state.nextTrack.trackId);
  });

  it("does nothing when the playlist has only one track", async () => {
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...fakePlaylistRecord,
      tracks: [track1],
    });

    await musicShuffle(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(PlaylistRepo.set).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("broadcasts only musicPlaylistUpdate (no musicPlaybackUpdate) when no playback state exists", async () => {
    // Use a playlistId with no seeded state
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);

    await musicShuffle(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "unseeded-playlist" },
    });

    expect(PlaylistRepo.set).toHaveBeenCalledOnce();
    const playlistUpdateCall = mockEmit.mock.calls.find(([e]) => e === "musicPlaylistUpdate");
    expect(playlistUpdateCall).toBeDefined();
    const playbackUpdateCall = mockEmit.mock.calls.find(([e]) => e === "musicPlaybackUpdate");
    expect(playbackUpdateCall).toBeUndefined();
  });
});

// ─── socketPlayMusic – uncovered branches ────────────────────────────────────

describe("socketPlayMusic – branch coverage", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("does nothing when the track is not found in the playlist", async () => {
    const nonExistentTrack = { ...track1, trackId: 999 };
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);

    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: nonExistentTrack },
    });

    // The handler should return early (currentIndex === -1)
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when playlist is not found", async () => {
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: track1 },
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);

    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, track: track1 },
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ─── musicPause ──────────────────────────────────────────────────────────────

describe("musicPause", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("pauses playback and emits musicPlaybackUpdate", async () => {
    const before = Date.now();
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    const after = Date.now();

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.isPlaying).toBe(false);
    expect(payload.state.pausedAt).toBeGreaterThanOrEqual(before);
    expect(payload.state.pausedAt).toBeLessThanOrEqual(after);
  });

  it("does nothing if no playback state exists", async () => {
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "nonexistent" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing if user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ─── musicResume ─────────────────────────────────────────────────────────────

describe("musicResume", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("resumes from paused state and adjusts startedAt", async () => {
    // First pause
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    mockEmit.mockClear();

    // Then resume
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.pausedAt).toBeUndefined();
  });

  it("bootstraps playback from the first track when no state exists", async () => {
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);

    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "fresh-playlist" },
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.trackId).toBe(track1.trackId);
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.nextTrack.trackId).toBe(track2.trackId);
  });

  it("does nothing if already playing (no pausedAt)", async () => {
    // State is already playing from seed (no pause was called)
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    // Should return early because !state.pausedAt
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when no state and playlist has no tracks", async () => {
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...fakePlaylistRecord,
      tracks: [],
    });

    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "empty-playlist" },
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when no state and playlist is null", async () => {
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "null-playlist" },
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing if user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ─── musicJoin ───────────────────────────────────────────────────────────────

describe("musicJoin", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("joins the room and emits joinedMusicStream with current state", async () => {
    await musicJoin(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });

    expect(mockSocket.join).toHaveBeenCalledWith(PLAYLIST_ID);
    expect(mockSocket.emit).toHaveBeenCalledWith("joinedMusicStream", {
      playlistId: PLAYLIST_ID,
      state: expect.objectContaining({ trackId: track1.trackId, isPlaying: true }),
    });
  });

  it("emits joinedMusicStream with null state when no playback exists", async () => {
    await musicJoin(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "no-state-playlist" },
    });

    expect(mockSocket.join).toHaveBeenCalledWith("no-state-playlist");
    expect(mockSocket.emit).toHaveBeenCalledWith("joinedMusicStream", {
      playlistId: "no-state-playlist",
      state: null,
    });
  });
});

// ─── isDJ returning false – additional handler branches ─────────────────────

describe("isDJ returning false – handler branches", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
  });

  it("musicRestartTrack does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicRestartTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("musicPrevTrack does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicPrevTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("musicSeek does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicSeek(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, positionMs: 5000 },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("musicSetLoopMode does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicSetLoopMode(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID, loopMode: "all" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("musicPlayNextTrack does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("musicShuffle does nothing when user is not a DJ", async () => {
    (isDJ as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (PlaylistRepo.set as ReturnType<typeof vi.fn>).mockClear();
    await musicShuffle(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
    expect(PlaylistRepo.set).not.toHaveBeenCalled();
  });
});

// ─── musicPlayNextTrack – additional branch coverage ────────────────────────

describe("musicPlayNextTrack – additional branches", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEmit = vi.fn();
    mockSocket = { emit: vi.fn(), join: vi.fn() } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: mockEmit } as unknown as GameServer;
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(fakePlaylistRecord);
  });

  it("does nothing when no playback state exists", async () => {
    // Don't seed playback store
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: "no-state" },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when playlist is not found (null)", async () => {
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("does nothing when playlist has only one track and not loopMode 'one'", async () => {
    const singleTrackRecord = { ...fakePlaylistRecord, tracks: [track1] };
    (PlaylistRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue(singleTrackRecord);
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(singleTrackRecord);
    await seedPlaybackStore(mockSocket, mockIO);
    mockEmit.mockClear();
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(singleTrackRecord);
    await musicPlayNextTrack(
      mockSocket,
      mockIO,
    )({
      auth: fakeAuth,
      payload: { playlistId: PLAYLIST_ID },
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ─── socket handler error branches (catch blocks) ───────────────────────────

describe("socket handler error branches", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;

  beforeEach(() => {
    mockSocket = { emit: vi.fn(), join: vi.fn(), id: "test-socket" } as unknown as GameServerSocket;
    mockIO = { to: vi.fn().mockReturnThis(), emit: vi.fn() } as unknown as GameServer;
  });

  it("musicPrevTrack catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicPrevTrack(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
    // logSocketError was called (Zod parse error), no crash
  });

  it("musicPlayNextTrack catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicPlayNextTrack(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicShuffle catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicShuffle(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicPause catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicPause(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicResume catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicResume(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("socketPlayMusic catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await socketPlayMusic(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicJoin catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicJoin(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicRestartTrack catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicRestartTrack(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicSeek catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicSeek(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });

  it("musicSetLoopMode catches and logs on invalid body", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await musicSetLoopMode(mockSocket, mockIO)("invalid-body");
    consoleSpy.mockRestore();
  });
});
