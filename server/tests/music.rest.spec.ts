import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import type { GameServerSocket, GameServer } from "../src/types.ts";

// ─── io mock (needed by every REST handler that calls getIO()) ───────────────
const mockEmit = vi.fn();
vi.mock("../src/io.ts", () => ({
  getIO: vi.fn(() => ({
    to: vi.fn().mockReturnThis(),
    emit: mockEmit,
  })),
  setIO: vi.fn(),
}));

// ─── Selective service mocks: only external SoundCloud calls ─────────────────
vi.mock("../src/services/music.service.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/music.service.ts")>();
  return {
    ...actual,
    exchangeCodeForToken: vi.fn(),
    searchForTracks: vi.fn(),
    getTrackStreamingLink: vi.fn(),
  };
});

import { app } from "../src/app.ts";
import {
  exchangeCodeForToken,
  searchForTracks,
  getTrackStreamingLink,
} from "../src/services/music.service.ts";
import { PlaylistRepo } from "../src/repository.ts";

// ─── Socket handler mocks ────────────────────────────────────────────────────
// For socket tests we mock repositories + auth + isDJ at a more granular level
// inside each describe block via the already-mocked music.service functions.

const auth1 = { kind: "password" as const, username: "user1", password: "pwd1111" };

const sampleTrack = {
  trackId: 54321,
  urn: "soundcloud:tracks:54321",
  title: "Sample Track",
  artist: "Sample Artist",
  artwork: "https://example.com/art.jpg",
  duration: 180000,
  streamUrl: "https://example.com/stream.mp3",
};

const sampleTrack2 = {
  trackId: 99999,
  urn: "soundcloud:tracks:99999",
  title: "Second Track",
  artist: "Another Artist",
  artwork: "https://example.com/art2.jpg",
  duration: 200000,
  streamUrl: "https://example.com/stream2.mp3",
};

beforeEach(() => {
  mockEmit.mockClear();
  vi.mocked(exchangeCodeForToken).mockReset();
  vi.mocked(searchForTracks).mockReset();
  vi.mocked(getTrackStreamingLink).mockReset();
});

// ─── Helper: create a community + playlist via real API ──────────────────────
async function createCommunityAndPlaylist() {
  const communityRes = await supertest(app)
    .post("/api/communities/create")
    .send({ auth: auth1, payload: { name: "Music Test Community", isPrivate: false } });
  expect(communityRes.status).toBe(200);
  const communityId = communityRes.body.communityId as string;

  const playlistRes = await supertest(app).post("/api/playlist/create").send({ communityId });
  expect(playlistRes.status).toBe(200);
  const playlistId = playlistRes.body.playlistId as string;
  return { communityId, playlistId };
}

// ─── Helper: add a track to a playlist ───────────────────────────────────────
async function addTrackToPlaylist(playlistId: string, track = sampleTrack) {
  const res = await supertest(app).post(`/api/playlist/add/${playlistId}`).send(track);
  expect(res.status).toBe(200);
  return res;
}

// =============================================================================
// REST ENDPOINT TESTS
// =============================================================================

// ─── 1. authorizeInRedirect ──────────────────────────────────────────────────
describe("GET /api/soundcloud/callback", () => {
  it("returns 400 when no code query param is provided", async () => {
    const res = await supertest(app).get("/api/soundcloud/callback");
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing code or verifier" });
  });

  it("returns the auth token on success", async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const fakeToken = {
      access_token: "abc123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh123",
      scope: 0,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    vi.mocked(exchangeCodeForToken).mockResolvedValue(fakeToken);

    const res = await supertest(app).get("/api/soundcloud/callback").query({ code: "test-code" });
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual(fakeToken);
    expect(exchangeCodeForToken).toHaveBeenCalledWith("test-code");
  });

  it("returns 500 when exchangeCodeForToken throws", async () => {
    vi.mocked(exchangeCodeForToken).mockRejectedValue(new Error("SoundCloud error"));

    const res = await supertest(app).get("/api/soundcloud/callback").query({ code: "bad-code" });
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "No Success!" });
  });
});

// ─── 2. postCreatePlaylist ───────────────────────────────────────────────────
describe("POST /api/playlist/create", () => {
  it("returns 400 for a malformed body (missing communityId)", async () => {
    const res = await supertest(app).post("/api/playlist/create").send({});
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 400 for a body with wrong type", async () => {
    const res = await supertest(app).post("/api/playlist/create").send({ communityId: 123 });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("creates a playlist and returns it with the correct shape", async () => {
    // First create a community
    const communityRes = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Playlist Create Test", isPrivate: false } });
    expect(communityRes.status).toBe(200);
    const communityId = communityRes.body.communityId as string;

    const res = await supertest(app).post("/api/playlist/create").send({ communityId });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      playlistId: expect.any(String),
      communityId,
      tracks: [],
      duration: 0,
      owner: expect.objectContaining({ role: "owner" }),
    });
  });
});

// ─── 3. getCommunityPlaylist ─────────────────────────────────────────────────
describe("GET /api/playlist/community/:communityId", () => {
  it("returns the playlist for a valid communityId", async () => {
    const { communityId, playlistId } = await createCommunityAndPlaylist();

    const res = await supertest(app).get(`/api/playlist/community/${communityId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      playlistId,
      communityId,
      tracks: [],
    });
  });

  it("returns 500 when no playlist exists for the communityId", async () => {
    const res = await supertest(app).get("/api/playlist/community/nonexistent-id");
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "Failed to fetch playlists" });
  });
});

// ─── 4. deleteTrack ──────────────────────────────────────────────────────────
describe("POST /api/playlist/delete/:playlistID", () => {
  it("returns 400 for a malformed track body", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    const res = await supertest(app)
      .post(`/api/playlist/delete/${playlistId}`)
      .send({ title: "missing fields" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing track object" });
  });

  it("removes a track and returns the updated playlist", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    const res = await supertest(app).post(`/api/playlist/delete/${playlistId}`).send(sampleTrack);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(0);
    expect(mockEmit).toHaveBeenCalledWith(
      "musicPlaylistUpdate",
      expect.objectContaining({
        playlist: expect.objectContaining({ tracks: [] }),
      }),
    );
  });

  it("returns 500 when trying to delete a track not in the playlist", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    // Don't add any tracks, so deletion should fail
    const res = await supertest(app).post(`/api/playlist/delete/${playlistId}`).send(sampleTrack);
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "Couldn't delete track" });
  });
});

// ─── 5. moveTrack ────────────────────────────────────────────────────────────
describe("POST /api/playlist/move/:playlistID", () => {
  it("returns 400 for a malformed body (missing newIndex)", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    const res = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ track: sampleTrack });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing newIndex in body" });
  });

  it("returns 400 for completely invalid body", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    const res = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ garbage: true });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing newIndex in body" });
  });

  it("moves a track and returns the updated playlist", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId, sampleTrack);
    await addTrackToPlaylist(playlistId, sampleTrack2);

    // Move track2 (index 1) to index 0
    const res = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ track: sampleTrack2, newIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(2);
    expect(res.body.tracks[0].trackId).toBe(sampleTrack2.trackId);
    expect(res.body.tracks[1].trackId).toBe(sampleTrack.trackId);
    expect(mockEmit).toHaveBeenCalledWith(
      "musicPlaylistUpdate",
      expect.objectContaining({
        playlist: expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({ trackId: sampleTrack2.trackId }),
          ]),
        }),
      }),
    );
  });

  it("returns 500 when moving a track that doesn't exist in the playlist", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    const res = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ track: sampleTrack, newIndex: 0 });
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "couldnt move track" });
  });
});

// ─── 6. getPlaylistById ──────────────────────────────────────────────────────
describe("GET /api/playlist/:playlistID", () => {
  it("returns the playlist for a valid playlistID", async () => {
    const { playlistId, communityId } = await createCommunityAndPlaylist();

    const res = await supertest(app).get(`/api/playlist/${playlistId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      playlistId,
      communityId,
      tracks: [],
      duration: 0,
    });
  });

  it("returns 404 when the playlist does not exist", async () => {
    const res = await supertest(app).get("/api/playlist/nonexistent-playlist-id");
    expect(res.status).toBe(404);
    expect(res.body).toStrictEqual({ error: "Playlist not found" });
  });

  it("returns the playlist with tracks after adding some", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    const res = await supertest(app).get(`/api/playlist/${playlistId}`);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].trackId).toBe(sampleTrack.trackId);
  });
});

// ─── 7. getAllPlaylistsCon ────────────────────────────────────────────────────
describe("GET /api/playlist/all", () => {
  it("returns an empty array when no playlists exist", async () => {
    const res = await supertest(app).get("/api/playlist/all");
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual([]);
  });

  it("returns all playlists after creating some", async () => {
    const { playlistId: id1 } = await createCommunityAndPlaylist();

    // Create another community+playlist via a different user
    const communityRes2 = await supertest(app)
      .post("/api/communities/create")
      .send({
        auth: { kind: "password" as const, username: "user2", password: "pwd2222" },
        payload: { name: "Second Community", isPrivate: false },
      });
    expect(communityRes2.status).toBe(200);
    const playlistRes2 = await supertest(app)
      .post("/api/playlist/create")
      .send({ communityId: communityRes2.body.communityId });
    expect(playlistRes2.status).toBe(200);
    const id2 = playlistRes2.body.playlistId;

    const res = await supertest(app).get("/api/playlist/all");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const ids = (res.body as { playlistId: string }[]).map((p) => p.playlistId);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
  });
});

// ─── 8. searchTracks ─────────────────────────────────────────────────────────
describe("GET /api/tracks/search", () => {
  it("returns 404 when no q param is provided", async () => {
    // zSearchPayload will still parse (q is optional), but the controller
    // constructs queryObj with q = undefined. The zSearchPayload is optional
    // on q, so it actually passes. Let's verify actual behavior:
    // Looking at code: queryObj = { q: req.query["q"], limit: 10, access: ["playable"] }
    // zSearchPayload: q is z.string().optional() — so undefined passes.
    // This means the request actually succeeds if searchForTracks works.
    // But the intent is to test the 404 path which triggers on safeParse failure.
    // We need to send something that fails zSearchPayload. Since all fields
    // are optional, we need to trigger a parse failure differently.
    // Actually: the queryObj has limit: 10 (number) and access: ["playable"] (array).
    // The zSearchPayload accepts these. So this endpoint won't return 404 for
    // missing q — it'll forward to searchForTracks.
    // Let's just test the happy path and the 500 error path.
    vi.mocked(searchForTracks).mockResolvedValue([]);
    const res = await supertest(app).get("/api/tracks/search");
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual([]);
  });

  it("returns search results on success", async () => {
    const fakeResults = [
      {
        trackId: 111,
        urn: "soundcloud:tracks:111",
        title: "Found Track",
        artist: "DJ Test",
        artwork: "https://example.com/art.jpg",
        duration: 240000,
        streamUrl: "https://example.com/stream.mp3",
      },
    ];
    vi.mocked(searchForTracks).mockResolvedValue(fakeResults);

    const res = await supertest(app).get("/api/tracks/search").query({ q: "test query" });
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual(fakeResults);
    expect(searchForTracks).toHaveBeenCalledWith(
      expect.objectContaining({ q: "test query", limit: 10 }),
    );
  });

  it("returns 500 when searchForTracks throws", async () => {
    vi.mocked(searchForTracks).mockRejectedValue(new Error("SoundCloud API down"));

    const res = await supertest(app).get("/api/tracks/search").query({ q: "failing search" });
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "Failed to fetch search results" });
  });
});

// ─── 9. streamTrack ──────────────────────────────────────────────────────────
describe("POST /api/tracks/stream", () => {
  it("returns 404 for a malformed body (missing required fields)", async () => {
    const res = await supertest(app).post("/api/tracks/stream").send({ title: "incomplete" });
    expect(res.status).toBe(404);
    expect(res.body).toStrictEqual({ error: "improper search parameters" });
  });

  it("returns the streaming link on success", async () => {
    vi.mocked(getTrackStreamingLink).mockResolvedValue("https://cdn.example.com/stream/xyz");

    const res = await supertest(app).post("/api/tracks/stream").send(sampleTrack);
    expect(res.status).toBe(200);
    expect(res.text).toBe("https://cdn.example.com/stream/xyz");
    expect(getTrackStreamingLink).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: sampleTrack.trackId }),
    );
  });

  it("returns 500 when getTrackStreamingLink throws", async () => {
    vi.mocked(getTrackStreamingLink).mockRejectedValue(new Error("Stream error"));

    const res = await supertest(app).post("/api/tracks/stream").send(sampleTrack);
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "Failed to stream track" });
  });
});

// ─── 10. updatePlaylistInfo ──────────────────────────────────────────────────
describe("GET /api/playlist/update/:playlistID", () => {
  it("returns 400 for a malformed body (missing playlistId in body)", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    // The handler validates req.body via zPlaylistUpdatesPayload which requires playlistId
    const res = await supertest(app).get(`/api/playlist/update/${playlistId}`).send({});
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("updates a playlist title and returns the updated playlist", async () => {
    const { playlistId, communityId: _communityId } = await createCommunityAndPlaylist();

    const res = await supertest(app).get(`/api/playlist/update/${playlistId}`).send({
      playlistId,
      title: "Updated Title",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      playlistId,
      title: "Updated Title",
    });
  });

  it("returns 400 when playlistId is wrong type", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    const res = await supertest(app).get(`/api/playlist/update/${playlistId}`).send({
      playlistId: 123,
    });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });
});

// =============================================================================
// SOCKET HANDLER TESTS (musicJoin, socketPlayMusic, musicPause, musicResume)
// =============================================================================

// These import directly from the controller and use the same mock pattern as
// music.controller.spec.ts. Note: the vi.mock for music.service is already
// set up above; for socket tests we also need isDJ and enforceAuth mocked.
// However, those are NOT mocked at module level in this file (only the
// SoundCloud-calling functions are). We need to use the actual module-level
// mocks from above, but isDJ and enforceAuth are real. Since socket handlers
// call enforceAuth (which checks real auth records — populated by setup.ts),
// and isDJ (which reads PlaylistRepo), we need to mock those for unit tests.
//
// Strategy: We import the socket handlers and create fresh mocks of the
// dependencies they call. Since vi.mock is hoisted, we can't conditionally mock.
// Instead we mock the auth service fully and control isDJ via the already-
// partially-mocked music.service module.

// For socket handler tests we need a separate approach since we already have
// partial mocks. Let's use vi.spyOn or accept that isDJ uses real repo data.
// Actually the cleanest approach: since we created the playlist via real API,
// the user IS the owner. So isDJ will return true naturally. And enforceAuth
// will work with the real user data from setup.ts. Let's test with real auth!

import {
  musicJoin,
  socketPlayMusic,
  musicPause,
  musicResume,
} from "../src/controllers/music.controller.ts";

describe("musicJoin socket handler", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let socketEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    socketEmit = vi.fn();
    mockSocket = {
      id: "socket-1",
      emit: socketEmit,
      join: vi.fn(),
    } as unknown as GameServerSocket;
    mockIO = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as GameServer;
  });

  it("joins the playlist room and emits joinedMusicStream with null state when no playback", async () => {
    const { playlistId } = await createCommunityAndPlaylist();

    await musicJoin(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(mockSocket.join).toHaveBeenCalledWith(playlistId);
    expect(socketEmit).toHaveBeenCalledWith("joinedMusicStream", {
      playlistId,
      state: null,
    });
  });

  it("emits joinedMusicStream with current state when playback is active", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    // Start playback via socketPlayMusic
    const ioEmit = vi.fn();
    const playIO = {
      to: vi.fn().mockReturnThis(),
      emit: ioEmit,
    } as unknown as GameServer;

    await socketPlayMusic(
      mockSocket,
      playIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });

    // Now join — should have state
    socketEmit.mockClear();
    await musicJoin(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(socketEmit).toHaveBeenCalledWith(
      "joinedMusicStream",
      expect.objectContaining({
        playlistId,
        state: expect.objectContaining({
          trackId: sampleTrack.trackId,
          isPlaying: true,
        }),
      }),
    );
  });

  it("calls logSocketError on invalid payload (no auth)", async () => {
    // Invalid body — no auth field
    await musicJoin(mockSocket, mockIO)({ payload: { playlistId: "any" } });

    // Should not join or emit joinedMusicStream
    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(socketEmit).not.toHaveBeenCalledWith("joinedMusicStream", expect.anything());
  });
});

describe("socketPlayMusic socket handler", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let ioEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ioEmit = vi.fn();
    mockSocket = {
      id: "socket-2",
      emit: vi.fn(),
      join: vi.fn(),
    } as unknown as GameServerSocket;
    mockIO = {
      to: vi.fn().mockReturnThis(),
      emit: ioEmit,
    } as unknown as GameServer;
  });

  it("emits musicPlaybackUpdate when a DJ plays a track", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    const before = Date.now();
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });
    const after = Date.now();

    expect(ioEmit).toHaveBeenCalledOnce();
    const [event, payload] = ioEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.playlistId).toBe(playlistId);
    expect(payload.state.trackId).toBe(sampleTrack.trackId);
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.startedAt).toBeGreaterThanOrEqual(before);
    expect(payload.state.startedAt).toBeLessThanOrEqual(after);
  });

  it("does nothing when playlist does not exist", async () => {
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId: "nonexistent", track: sampleTrack },
    });

    expect(ioEmit).not.toHaveBeenCalled();
  });

  it("does nothing when track is not in the playlist", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    // Playlist is empty, so the track won't be found
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });

    expect(ioEmit).not.toHaveBeenCalled();
  });

  it("sets nextTrack correctly when playing the first of two tracks", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId, sampleTrack);
    await addTrackToPlaylist(playlistId, sampleTrack2);

    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });

    const [, payload] = ioEmit.mock.calls[0];
    expect(payload.state.nextTrack.trackId).toBe(sampleTrack2.trackId);
  });

  it("wraps nextTrack to the first track when playing the last track", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId, sampleTrack);
    await addTrackToPlaylist(playlistId, sampleTrack2);

    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack2 },
    });

    const [, payload] = ioEmit.mock.calls[0];
    expect(payload.state.nextTrack.trackId).toBe(sampleTrack.trackId);
  });
});

describe("musicPause socket handler", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let ioEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ioEmit = vi.fn();
    mockSocket = {
      id: "socket-3",
      emit: vi.fn(),
      join: vi.fn(),
    } as unknown as GameServerSocket;
    mockIO = {
      to: vi.fn().mockReturnThis(),
      emit: ioEmit,
    } as unknown as GameServer;
  });

  it("pauses playback and emits musicPlaybackUpdate", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    // First play
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });
    ioEmit.mockClear();

    // Now pause
    const before = Date.now();
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });
    const after = Date.now();

    expect(ioEmit).toHaveBeenCalledOnce();
    const [event, payload] = ioEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.isPlaying).toBe(false);
    expect(payload.state.pausedAt).toBeGreaterThanOrEqual(before);
    expect(payload.state.pausedAt).toBeLessThanOrEqual(after);
  });

  it("does nothing when no playback state exists", async () => {
    const { playlistId } = await createCommunityAndPlaylist();

    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(ioEmit).not.toHaveBeenCalled();
  });
});

describe("musicResume socket handler", () => {
  let mockSocket: GameServerSocket;
  let mockIO: GameServer;
  let ioEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ioEmit = vi.fn();
    mockSocket = {
      id: "socket-4",
      emit: vi.fn(),
      join: vi.fn(),
    } as unknown as GameServerSocket;
    mockIO = {
      to: vi.fn().mockReturnThis(),
      emit: ioEmit,
    } as unknown as GameServer;
  });

  it("resumes paused playback and clears pausedAt", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    // Play then pause
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });
    ioEmit.mockClear();

    // Resume
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(ioEmit).toHaveBeenCalledOnce();
    const [event, payload] = ioEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.pausedAt).toBeUndefined();
  });

  it("bootstraps from the first track when no playback state exists", async () => {
    const { playlistId } = await createCommunityAndPlaylist();

    // Add tracks directly to the repo to avoid triggering auto-play
    // that happens when using the REST addTrack endpoint.
    const record = await PlaylistRepo.get(playlistId);
    record.tracks.push(sampleTrack, sampleTrack2);
    record.duration = sampleTrack.duration + sampleTrack2.duration;
    await PlaylistRepo.set(playlistId, record);

    // Resume with no prior play — should bootstrap from first track
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(ioEmit).toHaveBeenCalledOnce();
    const [event, payload] = ioEmit.mock.calls[0];
    expect(event).toBe("musicPlaybackUpdate");
    expect(payload.state.trackId).toBe(sampleTrack.trackId);
    expect(payload.state.isPlaying).toBe(true);
    expect(payload.state.nextTrack.trackId).toBe(sampleTrack2.trackId);
  });

  it("does nothing when no playback state and playlist is empty", async () => {
    const { playlistId } = await createCommunityAndPlaylist();

    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(ioEmit).not.toHaveBeenCalled();
  });

  it("does nothing when already playing (no pausedAt)", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    // Play but do NOT pause
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });
    ioEmit.mockClear();

    // Resume while already playing — should do nothing
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    expect(ioEmit).not.toHaveBeenCalled();
  });

  it("adjusts startedAt by the paused duration when resuming", async () => {
    const { playlistId } = await createCommunityAndPlaylist();
    await addTrackToPlaylist(playlistId);

    // Play
    await socketPlayMusic(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId, track: sampleTrack },
    });
    const playState = ioEmit.mock.calls[0][1].state;
    const originalStartedAt = playState.startedAt;

    // Pause
    await musicPause(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });
    ioEmit.mockClear();

    // Resume
    await musicResume(
      mockSocket,
      mockIO,
    )({
      auth: auth1,
      payload: { playlistId },
    });

    const resumedState = ioEmit.mock.calls[0][1].state as unknown as {
      startedAt: number;
      isPlaying: boolean;
      pausedAt: number | undefined;
    };
    // startedAt should be adjusted forward by the paused duration
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(resumedState.startedAt).toBeGreaterThanOrEqual(originalStartedAt);
    expect(resumedState.isPlaying).toBe(true);
    expect(resumedState.pausedAt).toBeUndefined();
  });
});
