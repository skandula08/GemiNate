import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

// Mock getIO so REST handlers don't throw "not initialized"
const mockEmit = vi.fn();
vi.mock("../src/io.ts", () => ({
  getIO: vi.fn(() => ({
    to: vi.fn().mockReturnThis(),
    emit: mockEmit,
  })),
  setIO: vi.fn(),
}));

beforeEach(() => {
  mockEmit.mockClear();
});

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
  trackId: 2167159869,
  urn: "soundcloud:tracks:2167159869",
  title: "Heavyweight",
  artist: "NewDad",
  artwork: "https://i1.sndcdn.com/artworks-k4tbPt6zC2Yh-0-large.jpg",
  duration: 187899,
  streamUrl: "https://api.soundcloud.com/tracks/soundcloud:tracks:2167159869/preview",
};

describe("POST /api/playlist/add/:playlistID", () => {
  let playlistId: string;

  beforeEach(async () => {
    const communityRes = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Music Test Community", isPrivate: false } });
    expect(communityRes.status).toBe(200);
    const communityId = communityRes.body.communityId as string;

    const playlistRes = await supertest(app).post("/api/playlist/create").send({ communityId });
    expect(playlistRes.status).toBe(200);
    playlistId = playlistRes.body.playlistId as string;
  });

  it("returns 400 for a malformed track body", async () => {
    const res = await supertest(app)
      .post(`/api/playlist/add/${playlistId}`)
      .send({ title: "missing required fields" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing track object" });
  });

  it("adds a track and returns the updated playlist containing that track", async () => {
    const res = await supertest(app).post(`/api/playlist/add/${playlistId}`).send(sampleTrack);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].trackId).toBe(54321);
    expect(res.body.tracks[0].title).toBe("Sample Track");
    expect(mockEmit).toHaveBeenCalledWith(
      "musicPlaylistUpdate",
      expect.objectContaining({
        playlist: expect.objectContaining({
          tracks: expect.arrayContaining([expect.objectContaining({ trackId: 54321 })]),
        }),
      }),
    );
  });

  it("allows adding a second track and returns both in the playlist", async () => {
    const secondTrack = { ...sampleTrack, trackId: 99999, title: "Second Track" };
    // First add the original track
    await supertest(app).post(`/api/playlist/add/${playlistId}`).send(sampleTrack);
    // Then add the second track
    const res = await supertest(app).post(`/api/playlist/add/${playlistId}`).send(secondTrack);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(2);
  });
});

describe("POST /api/playlist/delete/:playlistID", () => {
  let playlistId: string;
  beforeEach(async () => {
    const communityRes = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Music Test Community", isPrivate: false } });
    expect(communityRes.status).toBe(200);
    const communityId = communityRes.body.communityId as string;

    const playlistRes = await supertest(app).post("/api/playlist/create").send({ communityId });
    expect(playlistRes.status).toBe(200);
    playlistId = playlistRes.body.playlistId as string;
    const addTrack = await supertest(app).post(`/api/playlist/add/${playlistId}`).send(sampleTrack);
    expect(addTrack.status).toBe(200);
  });

  it("returns 400 for a malformed track body", async () => {
    const res = await supertest(app)
      .post(`/api/playlist/delete/${playlistId}`)
      .send({ title: "missing required fields" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing track object" });
  });

  it("removes the given track from a playlist and returns the updated playlist", async () => {
    const res = await supertest(app).post(`/api/playlist/delete/${playlistId}`).send(sampleTrack);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(0);
    expect(res.body.tracks).toStrictEqual([]);
  });
});

describe("POST /api/playlist/move/:playlistID", () => {
  let playlistId: string;
  const movePayload = {
    track: sampleTrack2,
    newIndex: 0,
  };
  beforeEach(async () => {
    const communityRes = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Music Test Community", isPrivate: false } });
    expect(communityRes.status).toBe(200);
    const communityId = communityRes.body.communityId as string;

    const playlistRes = await supertest(app).post("/api/playlist/create").send({ communityId });
    expect(playlistRes.status).toBe(200);
    playlistId = playlistRes.body.playlistId as string;
    const addTrack1 = await supertest(app)
      .post(`/api/playlist/add/${playlistId}`)
      .send(sampleTrack);
    expect(addTrack1.status).toBe(200);
    const addTrack2 = await supertest(app)
      .post(`/api/playlist/add/${playlistId}`)
      .send(sampleTrack2);
    expect(addTrack2.status).toBe(200);
  });

  it("returns 400 for a malformed track body", async () => {
    const res = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ title: "missing required fields" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Missing newIndex in body" });
  });

  it("moves the given track to the specified index in the track list, then returns the playlist", async () => {
    const res = await supertest(app).post(`/api/playlist/move/${playlistId}`).send(movePayload);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(2);
    expect(res.body.tracks[0].trackId).toBe(2167159869);
    expect(res.body.tracks[1].trackId).toBe(54321);
    // expect(res.body.tracks[0].title).toBe("Heavyweight");
  });

  it("returns 500 when you there are no tracks to move in the playlist", async () => {
    const incorrectTrack = {
      trackId: 0,
      urn: "soundcloud:tracks:54321",
      title: "Sample Track",
      artist: "Sample Artist",
      artwork: "https://example.com/art.jpg",
      duration: 180000,
      streamUrl: "https://example.com/stream.mp3",
    };
    const res = await supertest(app)
      .post(`/api/playlist/move/${"incorret-playlistid"}`)
      .send({ ...movePayload, newIndex: 0 });
    expect(res.status).toBe(500);
    expect(res.status).toBe(500);
    const res2 = await supertest(app)
      .post(`/api/playlist/move/${playlistId}`)
      .send({ track: incorrectTrack, newIndex: 0 });
    expect(res2.status).toBe(500);
    expect(res.body).toStrictEqual({ error: "couldnt move track" });
    expect(res2.body).toStrictEqual({ error: "couldnt move track" });
  });
});

describe("GET /api/playlist/:playlistID", () => {
  let playlistId: string;
  beforeEach(async () => {
    const communityRes = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Music Test Community", isPrivate: false } });
    expect(communityRes.status).toBe(200);
    const communityId = communityRes.body.communityId as string;

    const playlistRes = await supertest(app).post("/api/playlist/create").send({ communityId });
    expect(playlistRes.status).toBe(200);
    playlistId = playlistRes.body.playlistId as string;
    const addTrack2 = await supertest(app)
      .post(`/api/playlist/add/${playlistId}`)
      .send(sampleTrack);
    expect(addTrack2.status).toBe(200);
  });
  it("returns 404 for parameters containing a playlistID that doesn't exist", async () => {
    const res = await supertest(app).get(`/api/playlist/${playlistId}1232`);
    expect(res.status).toBe(404);
    expect.objectContaining({ error: "Playlist not found" });
  });

  it("returns a playlist given a valid id", async () => {
    const res = await supertest(app).get(`/api/playlist/${playlistId}`);
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].trackId).toBe(54321);
    expect(res.body.tracks[0].title).toBe("Sample Track");
  });
});
