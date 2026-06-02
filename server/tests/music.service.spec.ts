/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track, TrackInput, AuthToken } from "@gamenite/shared";
import { PlaylistRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import {
  createCommunity,
  joinCommunity,
  setCommunityRole,
} from "../src/services/community.services.ts";
import {
  getTrackFromInput,
  getAuthenticationURL,
  populatePlaylistInfo,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  moveTrackInPlaylist,
  getPlaylistByCommunity,
  getAllPlaylists,
  updatePlaylistInformation,
  syncPlaylistRolesFromCommunity,
  isDJ,
} from "../src/services/music.service.ts";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const sampleTrackInput: TrackInput = {
  trackId: 123,
  urn: "soundcloud:tracks:123",
  title: "Test",
  artist: "Artist",
  artwork: "http://art.jpg",
  duration: 180000,
  streamUrl: "http://stream",
};

const sampleTrackInput2: TrackInput = {
  trackId: 456,
  urn: "soundcloud:tracks:456",
  title: "Second",
  artist: "Artist2",
  artwork: "http://art2.jpg",
  duration: 240000,
  streamUrl: "http://stream2",
};

const sampleTrackInput3: TrackInput = {
  trackId: 789,
  urn: "soundcloud:tracks:789",
  title: "Third",
  artist: "Artist3",
  artwork: "http://art3.jpg",
  duration: 120000,
  streamUrl: "http://stream3",
};

const fakeToken: AuthToken = {
  access_token: "tok",
  token_type: "Bearer",
  expires_in: 3600,
  refresh_token: "ref",
  scope: 0,
};

// ---------------------------------------------------------------------------
// Helper: create a community with owner=user0, members user1-user3, user1=dj
// Returns communityId and userId map
// ---------------------------------------------------------------------------
async function setupCommunityWithDJ() {
  const user0 = (await getUserByUsername("user0"))!;
  const user1 = (await getUserByUsername("user1"))!;
  const user2 = (await getUserByUsername("user2"))!;

  const communityId = await createCommunity(user0.userId, "TestCommunity", false, "desc");

  // user1 and user2 join
  await joinCommunity(communityId, user1);
  await joinCommunity(communityId, user2);

  // promote user1 to dj
  await setCommunityRole(communityId, user0, "user1", "dj");

  return { communityId, user0, user1, user2 };
}

// ==========================================================================
// CATEGORY 1 – Functions that work with real repos
// ==========================================================================
describe("Category 1: Repo-backed functions", () => {
  // The global setup.ts seeds user0-user3 via resetEverythingToDefaults().
  // We clear PlaylistRepo before each test since the global setup doesn't.
  beforeEach(async () => {
    await PlaylistRepo.clear();
  });

  // -----------------------------------------------------------------------
  // getTrackFromInput
  // -----------------------------------------------------------------------
  describe("getTrackFromInput", () => {
    it("maps every TrackInput field to a Track", () => {
      const track = getTrackFromInput(sampleTrackInput);
      expect(track).toStrictEqual({
        trackId: 123,
        urn: "soundcloud:tracks:123",
        title: "Test",
        artist: "Artist",
        artwork: "http://art.jpg",
        duration: 180000,
        streamUrl: "http://stream",
      });
    });

    it("handles null artist", () => {
      const input: TrackInput = { ...sampleTrackInput, artist: null };
      const track = getTrackFromInput(input);
      expect(track.artist).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getAuthenticationURL
  // -----------------------------------------------------------------------
  describe("getAuthenticationURL", () => {
    it("returns a string containing the authorize endpoint", () => {
      const url = getAuthenticationURL();
      expect(url).toContain("https://secure.soundcloud.com/authorize");
    });

    it("includes required OAuth query params", () => {
      const url = getAuthenticationURL();
      expect(url).toContain("client_id=");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("response_type=code");
      expect(url).toContain("code_challenge=");
      expect(url).toContain("code_challenge_method=S256");
      expect(url).toContain("state=");
    });
  });

  // -----------------------------------------------------------------------
  // createPlaylist
  // -----------------------------------------------------------------------
  describe("createPlaylist", () => {
    it("creates a playlist from a community with correct owner and djList", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const playlist = await createPlaylist(communityId, new Date());

      expect(playlist.communityId).toBe(communityId);
      expect(playlist.owner.user.username).toBe("user0");
      expect(playlist.owner.role).toBe("owner");
      expect(playlist.djList).toHaveLength(1);
      expect(playlist.djList[0].user.username).toBe("user1");
      expect(playlist.djList[0].role).toBe("dj");
      expect(playlist.tracks).toStrictEqual([]);
      expect(playlist.duration).toBe(0);
      expect(playlist.title).toBe("TestCommunity");
    });

    it("creates a playlist with empty djList when community has no DJs", async () => {
      const user0 = (await getUserByUsername("user0"))!;
      const communityId = await createCommunity(user0.userId, "NoDJs", false);
      const playlist = await createPlaylist(communityId, new Date());

      expect(playlist.djList).toHaveLength(0);
      expect(playlist.owner.user.username).toBe("user0");
    });
  });

  // -----------------------------------------------------------------------
  // populatePlaylistInfo
  // -----------------------------------------------------------------------
  describe("populatePlaylistInfo", () => {
    it("returns a fully populated Playlist with SafeUserInfo in owner and djList", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const populated = await populatePlaylistInfo(created.playlistId);
      expect(populated.playlistId).toBe(created.playlistId);
      expect(populated.owner.user).toHaveProperty("username");
      expect(populated.owner.user).toHaveProperty("display");
      expect(populated.owner.user).toHaveProperty("createdAt");
      expect(populated.djList[0].user).toHaveProperty("username");
    });
  });

  // -----------------------------------------------------------------------
  // addTrackToPlaylist
  // -----------------------------------------------------------------------
  describe("addTrackToPlaylist", () => {
    it("adds a track and updates duration", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const updated = await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      expect(updated.tracks).toHaveLength(1);
      expect(updated.tracks[0].trackId).toBe(123);
      expect(updated.tracks[0].title).toBe("Test");
      expect(updated.duration).toBe(180000);
    });

    it("accumulates duration across multiple tracks", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      const updated = await addTrackToPlaylist(created.playlistId, sampleTrackInput2);

      expect(updated.tracks).toHaveLength(2);
      expect(updated.duration).toBe(180000 + 240000);
    });
  });

  // -----------------------------------------------------------------------
  // removeTrackFromPlaylist
  // -----------------------------------------------------------------------
  describe("removeTrackFromPlaylist", () => {
    it("removes an existing track and decreases duration", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput2);

      const trackToRemove: Track = getTrackFromInput(sampleTrackInput);
      const updated = await removeTrackFromPlaylist(created.playlistId, trackToRemove);

      expect(updated.tracks).toHaveLength(1);
      expect(updated.tracks[0].trackId).toBe(456);
      expect(updated.duration).toBe(240000);
    });

    it("throws if track is not in playlist", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const bogusTrack: Track = { ...getTrackFromInput(sampleTrackInput), trackId: 999 };
      await expect(removeTrackFromPlaylist(created.playlistId, bogusTrack)).rejects.toThrow(
        "Track not found in playlist",
      );
    });
  });

  // -----------------------------------------------------------------------
  // moveTrackInPlaylist
  // -----------------------------------------------------------------------
  describe("moveTrackInPlaylist", () => {
    it("moves a track from index 0 to index 2", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput2);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput3);

      const updated = await moveTrackInPlaylist(created.playlistId, 123, 2);

      expect(updated.tracks[0].trackId).toBe(456);
      expect(updated.tracks[1].trackId).toBe(789);
      expect(updated.tracks[2].trackId).toBe(123);
    });

    it("moves a track from the end to the beginning", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput2);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput3);

      const updated = await moveTrackInPlaylist(created.playlistId, 789, 0);

      expect(updated.tracks[0].trackId).toBe(789);
      expect(updated.tracks[1].trackId).toBe(123);
      expect(updated.tracks[2].trackId).toBe(456);
    });

    it("clamps newIndex to valid range (negative)", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput2);

      const updated = await moveTrackInPlaylist(created.playlistId, 456, -5);

      expect(updated.tracks[0].trackId).toBe(456);
      expect(updated.tracks[1].trackId).toBe(123);
    });

    it("clamps newIndex to valid range (too large)", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);
      await addTrackToPlaylist(created.playlistId, sampleTrackInput2);

      const updated = await moveTrackInPlaylist(created.playlistId, 123, 100);

      expect(updated.tracks[0].trackId).toBe(456);
      expect(updated.tracks[1].trackId).toBe(123);
    });

    it("throws if trackId is not found in playlist", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      await addTrackToPlaylist(created.playlistId, sampleTrackInput);

      await expect(moveTrackInPlaylist(created.playlistId, 999, 0)).rejects.toThrow(
        "Track not found in playlist",
      );
    });
  });

  // -----------------------------------------------------------------------
  // getPlaylistByCommunity
  // -----------------------------------------------------------------------
  describe("getPlaylistByCommunity", () => {
    it("returns the playlist associated with a communityId", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const found = await getPlaylistByCommunity(communityId);
      expect(found.playlistId).toBe(created.playlistId);
      expect(found.communityId).toBe(communityId);
    });

    it("throws when no playlist exists for the communityId", async () => {
      await expect(getPlaylistByCommunity("nonexistent-community")).rejects.toThrow(
        "No playlist found for communityId",
      );
    });
  });

  // -----------------------------------------------------------------------
  // getAllPlaylists
  // -----------------------------------------------------------------------
  describe("getAllPlaylists", () => {
    it("returns an empty array when no playlists exist", async () => {
      const all = await getAllPlaylists();
      expect(all).toStrictEqual([]);
    });

    it("returns all playlists, fully populated", async () => {
      const user0 = (await getUserByUsername("user0"))!;
      const c1 = await createCommunity(user0.userId, "Comm1", false);

      // Need a different user for second community (rate limit: 1 community per day per user)
      const user1 = (await getUserByUsername("user1"))!;
      const c2 = await createCommunity(user1.userId, "Comm2", false);

      await createPlaylist(c1, new Date());
      await createPlaylist(c2, new Date());

      const all = await getAllPlaylists();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.title).sort()).toStrictEqual(["Comm1", "Comm2"]);
    });
  });

  // -----------------------------------------------------------------------
  // updatePlaylistInformation
  // -----------------------------------------------------------------------
  describe("updatePlaylistInformation", () => {
    it("updates the title of a playlist", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const updated = await updatePlaylistInformation({
        playlistId: created.playlistId,
        title: "NewTitle",
      });

      expect(updated.title).toBe("NewTitle");
    });

    it("updates the owner of a playlist", async () => {
      const { communityId, user1 } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const updated = await updatePlaylistInformation({
        playlistId: created.playlistId,
        owner: { user: user1.userId, role: "owner" },
      });

      expect(updated.owner.user.username).toBe("user1");
      expect(updated.owner.role).toBe("owner");
    });

    it("updates the djList of a playlist", async () => {
      const { communityId, user2 } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const updated = await updatePlaylistInformation({
        playlistId: created.playlistId,
        djList: [{ user: user2.userId, role: "dj" }],
      });

      expect(updated.djList).toHaveLength(1);
      expect(updated.djList[0].user.username).toBe("user2");
    });

    it("preserves fields that are not included in the payload", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const updated = await updatePlaylistInformation({
        playlistId: created.playlistId,
        title: "OnlyTitle",
      });

      // Owner should be unchanged
      expect(updated.owner.user.username).toBe("user0");
      expect(updated.title).toBe("OnlyTitle");
    });
  });

  // -----------------------------------------------------------------------
  // syncPlaylistRolesFromCommunity
  // -----------------------------------------------------------------------
  describe("syncPlaylistRolesFromCommunity", () => {
    it("syncs the owner and djList from community participants", async () => {
      const { communityId, user0 } = await setupCommunityWithDJ();
      await createPlaylist(communityId, new Date());

      // promote user2 to dj in the community
      await setCommunityRole(communityId, user0, "user2", "dj");

      const synced = await syncPlaylistRolesFromCommunity(communityId);
      expect(synced).toBeDefined();
      expect(synced!.djList).toHaveLength(2);
      const djUsernames = synced!.djList.map((dj) => dj.user.username).sort();
      expect(djUsernames).toStrictEqual(["user1", "user2"]);
      expect(synced!.owner.user.username).toBe("user0");
    });

    it("throws when the communityId does not exist", async () => {
      await expect(syncPlaylistRolesFromCommunity("no-such-community")).rejects.toThrow();
    });

    it("returns undefined when community exists but has no playlist", async () => {
      const user0 = (await getUserByUsername("user0"))!;
      const communityId = await createCommunity(user0.userId, "NoPlaylist", false);
      const result = await syncPlaylistRolesFromCommunity(communityId);
      expect(result).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // isDJ
  // -----------------------------------------------------------------------
  describe("isDJ", () => {
    it("returns true for the playlist owner", async () => {
      const { communityId, user0 } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const result = await isDJ(user0.userId, created.playlistId);
      expect(result).toBe(true);
    });

    it("returns true for a user in the djList", async () => {
      const { communityId, user1 } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const result = await isDJ(user1.userId, created.playlistId);
      expect(result).toBe(true);
    });

    it("returns false for a regular member", async () => {
      const { communityId, user2 } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const result = await isDJ(user2.userId, created.playlistId);
      expect(result).toBe(false);
    });

    it("returns false for a user not in the community at all", async () => {
      const { communityId } = await setupCommunityWithDJ();
      const created = await createPlaylist(communityId, new Date());

      const user3 = (await getUserByUsername("user3"))!;
      const result = await isDJ(user3.userId, created.playlistId);
      expect(result).toBe(false);
    });
  });
});

// ==========================================================================
// CATEGORY 2 – External API functions (mock global fetch)
// ==========================================================================
describe("Category 2: External API functions", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  // Helper to dynamically import a fresh module with clean token state
  async function freshImport() {
    return await import("../src/services/music.service.ts");
  }

  // -----------------------------------------------------------------------
  // exchangeCodeForToken
  // -----------------------------------------------------------------------
  describe("exchangeCodeForToken", () => {
    it("POSTs to the OAuth token endpoint and returns an AuthToken", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      const result = await mod.exchangeCodeForToken("auth-code-123");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(String(url)).toContain("oauth/token");
      expect(options.method).toBe("POST");
      expect(options.body.toString()).toContain("grant_type=authorization_code");
      expect(options.body.toString()).toContain("code=auth-code-123");
      expect(result).toStrictEqual(fakeToken);
    });
  });

  // -----------------------------------------------------------------------
  // refreshAuthToken
  // -----------------------------------------------------------------------
  describe("refreshAuthToken", () => {
    it("refreshes an existing token successfully", async () => {
      const refreshedToken: AuthToken = {
        access_token: "new-tok",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "new-ref",
        scope: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedToken),
      });

      const mod = await freshImport();
      // Should not throw
      await mod.refreshAuthToken(fakeToken);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(String(url)).toContain("oauth/token");
      expect(options.method).toBe("POST");
      expect(options.body.toString()).toContain("grant_type=refresh_token");
      expect(options.body.toString()).toContain(`refresh_token=${fakeToken.refresh_token}`);
    });

    it("throws when the response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const mod = await freshImport();
      await expect(mod.refreshAuthToken(fakeToken)).rejects.toThrow("Failed to refresh token");
    });
  });

  // -----------------------------------------------------------------------
  // credentialsFlow
  // -----------------------------------------------------------------------
  describe("credentialsFlow", () => {
    it("performs client credentials flow and returns AuthToken", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      const result = await mod.credentialsFlow("myClientId", "myClientSecret");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(String(url)).toContain("oauth/token");
      expect(options.method).toBe("POST");
      expect(options.headers.authorization).toContain("Basic ");
      expect(options.body.toString()).toContain("grant_type=client_credentials");
      expect(result).toStrictEqual(fakeToken);
    });

    it("throws when the response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const mod = await freshImport();
      await expect(mod.credentialsFlow("bad", "bad")).rejects.toThrow("HTTP Error!");
    });

    it("encodes clientID:clientSecret as base64 in the Authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      await mod.credentialsFlow("testId", "testSecret");

      const expectedBasic = `Basic ${btoa("testId:testSecret")}`;
      const [, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(options.headers.authorization).toBe(expectedBasic);
    });
  });

  // -----------------------------------------------------------------------
  // searchForTracks
  // -----------------------------------------------------------------------
  describe("searchForTracks", () => {
    it("searches for tracks and maps SoundcloudTrack[] to Track[]", async () => {
      const scTrack = {
        id: 111,
        urn: "soundcloud:tracks:111",
        title: "SC Track",
        metadata_artist: "SC Artist",
        artwork_url: "http://art.sc",
        duration: 300000,
        stream_url: "http://stream.sc",
      };

      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([scTrack]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      const results = await mod.searchForTracks({ q: "test", limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        trackId: 111,
        urn: "soundcloud:tracks:111",
        title: "SC Track",
        artist: "SC Artist",
        artwork: "http://art.sc",
        duration: 300000,
        streamUrl: "http://stream.sc",
      });
    });

    it("returns empty array when API returns no tracks", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      const results = await mod.searchForTracks({ q: "noresults" });
      expect(results).toStrictEqual([]);
    });

    it("passes search params in the URL query string", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      await mod.searchForTracks({ q: "hello", genres: "rock", limit: 10 });

      const searchCall = mockFetch.mock.calls.find(
        ([url]) => String(url).includes("api.soundcloud.com/tracks") && String(url).includes("q="),
      );
      expect(searchCall).toBeDefined();
      const urlStr = String(searchCall![0]);
      expect(urlStr).toContain("q=hello");
      expect(urlStr).toContain("genres=rock");
      expect(urlStr).toContain("limit=10");
    });
  });

  // -----------------------------------------------------------------------
  // getTrackStreamingLink
  // -----------------------------------------------------------------------
  describe("getTrackStreamingLink", () => {
    const fakeTrack: Track = {
      trackId: 98765,
      urn: "soundcloud:tracks:98765",
      title: "Test Track",
      artist: null,
      artwork: "https://i1.sndcdn.com/artworks-000.jpg",
      duration: 200000,
      streamUrl: "",
    };

    it("constructs URL with numeric trackId and returns the CDN redirect URL", async () => {
      const mp3Url = "https://api.soundcloud.com/tracks/98765/stream?client_id=abc";
      const finalCdnUrl = "https://cf-media.soundcloud.com/abc123.mp3?Policy=xxx";

      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                http_mp3_128_url: mp3Url,
                hls_mp3_128_url: "",
                hls_aac_160_url: "",
                http_mpreview_mp3_128_urlp3_128_url: "",
              }),
          });
        }
        if (String(url) === mp3Url) {
          return Promise.resolve({ ok: true, url: finalCdnUrl, json: () => Promise.resolve({}) });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      const result = await mod.getTrackStreamingLink(fakeTrack);

      const streamsCall = mockFetch.mock.calls.find(([url]) => String(url).includes("/streams"));
      expect(streamsCall).toBeDefined();
      expect(String(streamsCall![0])).toMatch(/tracks\/98765\/streams/);
      expect(String(streamsCall![0])).not.toContain("soundcloud:tracks");
      expect(result).toBe(finalCdnUrl);
    });

    it("throws when the streams endpoint returns non-ok response", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      await expect(mod.getTrackStreamingLink(fakeTrack)).rejects.toThrow(
        "Failed to fetch streams for track 98765",
      );
    });

    it("throws when no http_mp3_128_url is present", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                http_mp3_128_url: "",
                hls_mp3_128_url: "something",
                hls_aac_160_url: "",
                http_mpreview_mp3_128_urlp3_128_url: "",
              }),
          });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      await expect(mod.getTrackStreamingLink(fakeTrack)).rejects.toThrow(
        "No streamable URL for track 98765",
      );
    });
  });

  // -----------------------------------------------------------------------
  // getAccessToken
  // -----------------------------------------------------------------------
  describe("getAccessToken", () => {
    it("calls credentialsFlow when no cached token exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      const result = await mod.getAccessToken();

      expect(result.access_token).toBe("tok");
      expect(result.token_type).toBe("Bearer");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns the cached token on subsequent calls without re-fetching", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      await mod.getAccessToken();
      const result2 = await mod.getAccessToken();

      // Only one fetch call (the initial credentialsFlow)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.access_token).toBe("tok");
    });

    it("refreshes the token when it is near expiry", async () => {
      const almostExpiredToken: AuthToken = {
        ...fakeToken,
        expires_in: 0, // will compute expires_at ≈ Date.now() + 0 = already expired
      };

      const refreshedToken: AuthToken = {
        access_token: "refreshed-tok",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refreshed-ref",
        scope: 0,
      };

      // First call: credentialsFlow returns an already-expired token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(almostExpiredToken),
      });
      // Second call: refreshAuthToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedToken),
      });

      const mod = await freshImport();
      // First getAccessToken triggers credentialsFlow, then detects near-expiry and refreshes
      const result = await mod.getAccessToken();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.access_token).toBe("refreshed-tok");
    });
  });

  // -----------------------------------------------------------------------
  // refreshAuthToken
  // -----------------------------------------------------------------------
  describe("refreshAuthToken", () => {
    it("refreshes an existing token successfully", async () => {
      const refreshedToken: AuthToken = {
        access_token: "new-tok",
        token_type: "Bearer",
        expires_in: 7200,
        refresh_token: "new-ref",
        scope: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedToken),
      });

      const mod = await freshImport();
      // Should not throw
      await mod.refreshAuthToken(fakeToken);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(String(url)).toContain("oauth/token");
      expect(options.method).toBe("POST");
      expect(options.body.toString()).toContain("grant_type=refresh_token");
      expect(options.body.toString()).toContain(`refresh_token=${fakeToken.refresh_token}`);
    });

    it("throws when the response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const mod = await freshImport();
      await expect(mod.refreshAuthToken(fakeToken)).rejects.toThrow("Failed to refresh token");
    });
  });

  // -----------------------------------------------------------------------
  // credentialsFlow
  // -----------------------------------------------------------------------
  describe("credentialsFlow", () => {
    it("performs client credentials flow and returns AuthToken", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      const result = await mod.credentialsFlow("myClientId", "myClientSecret");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(String(url)).toContain("oauth/token");
      expect(options.method).toBe("POST");
      expect(options.headers.authorization).toContain("Basic ");
      expect(options.body.toString()).toContain("grant_type=client_credentials");
      expect(result).toStrictEqual(fakeToken);
    });

    it("throws when the response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const mod = await freshImport();
      await expect(mod.credentialsFlow("bad", "bad")).rejects.toThrow("HTTP Error!");
    });

    it("encodes clientID:clientSecret as base64 in the Authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      await mod.credentialsFlow("testId", "testSecret");

      const expectedBasic = `Basic ${btoa("testId:testSecret")}`;
      const [, options] = mockFetch.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: URLSearchParams },
      ];
      expect(options.headers.authorization).toBe(expectedBasic);
    });
  });

  // -----------------------------------------------------------------------
  // searchForTracks
  // -----------------------------------------------------------------------
  describe("searchForTracks", () => {
    it("searches for tracks and maps SoundcloudTrack[] to Track[]", async () => {
      const scTrack = {
        id: 111,
        urn: "soundcloud:tracks:111",
        title: "SC Track",
        metadata_artist: "SC Artist",
        artwork_url: "http://art.sc",
        duration: 300000,
        stream_url: "http://stream.sc",
      };

      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([scTrack]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      const results = await mod.searchForTracks({ q: "test", limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        trackId: 111,
        urn: "soundcloud:tracks:111",
        title: "SC Track",
        artist: "SC Artist",
        artwork: "http://art.sc",
        duration: 300000,
        streamUrl: "http://stream.sc",
      });
    });

    it("returns empty array when API returns no tracks", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      const results = await mod.searchForTracks({ q: "noresults" });
      expect(results).toStrictEqual([]);
    });

    it("passes search params in the URL query string", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("api.soundcloud.com/tracks")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        throw new Error(`Unexpected fetch: ${String(url)}`);
      });

      const mod = await freshImport();
      await mod.searchForTracks({ q: "hello", genres: "rock", limit: 10 });

      const searchCall = mockFetch.mock.calls.find(
        ([url]) => String(url).includes("api.soundcloud.com/tracks") && String(url).includes("q="),
      );
      expect(searchCall).toBeDefined();
      const urlStr = String(searchCall![0]);
      expect(urlStr).toContain("q=hello");
      expect(urlStr).toContain("genres=rock");
      expect(urlStr).toContain("limit=10");
    });
  });

  // -----------------------------------------------------------------------
  // getTrackStreamingLink
  // -----------------------------------------------------------------------
  describe("getTrackStreamingLink", () => {
    const fakeTrack: Track = {
      trackId: 98765,
      urn: "soundcloud:tracks:98765",
      title: "Test Track",
      artist: null,
      artwork: "https://i1.sndcdn.com/artworks-000.jpg",
      duration: 200000,
      streamUrl: "",
    };

    it("constructs URL with numeric trackId and returns the CDN redirect URL", async () => {
      const mp3Url = "https://api.soundcloud.com/tracks/98765/stream?client_id=abc";
      const finalCdnUrl = "https://cf-media.soundcloud.com/abc123.mp3?Policy=xxx";

      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                http_mp3_128_url: mp3Url,
                hls_mp3_128_url: "",
                hls_aac_160_url: "",
                http_mpreview_mp3_128_urlp3_128_url: "",
              }),
          });
        }
        if (String(url) === mp3Url) {
          return Promise.resolve({ ok: true, url: finalCdnUrl, json: () => Promise.resolve({}) });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      const result = await mod.getTrackStreamingLink(fakeTrack);

      const streamsCall = mockFetch.mock.calls.find(([url]) => String(url).includes("/streams"));
      expect(streamsCall).toBeDefined();
      expect(String(streamsCall![0])).toMatch(/tracks\/98765\/streams/);
      expect(String(streamsCall![0])).not.toContain("soundcloud:tracks");
      expect(result).toBe(finalCdnUrl);
    });

    it("throws when the streams endpoint returns non-ok response", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      await expect(mod.getTrackStreamingLink(fakeTrack)).rejects.toThrow(
        "Failed to fetch streams for track 98765",
      );
    });

    it("throws when no http_mp3_128_url is present", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (String(url).includes("oauth/token")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeToken) });
        }
        if (String(url).includes("/streams")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                http_mp3_128_url: "",
                hls_mp3_128_url: "something",
                hls_aac_160_url: "",
                http_mpreview_mp3_128_urlp3_128_url: "",
              }),
          });
        }
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      });

      const mod = await freshImport();
      await expect(mod.getTrackStreamingLink(fakeTrack)).rejects.toThrow(
        "No streamable URL for track 98765",
      );
    });
  });

  // -----------------------------------------------------------------------
  // getAccessToken
  // -----------------------------------------------------------------------
  describe("getAccessToken", () => {
    it("calls credentialsFlow when no cached token exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      const result = await mod.getAccessToken();

      expect(result.access_token).toBe("tok");
      expect(result.token_type).toBe("Bearer");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns the cached token on subsequent calls without re-fetching", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeToken),
      });

      const mod = await freshImport();
      await mod.getAccessToken();
      const result2 = await mod.getAccessToken();

      // Only one fetch call (the initial credentialsFlow)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.access_token).toBe("tok");
    });

    it("refreshes the token when it is near expiry", async () => {
      const almostExpiredToken: AuthToken = {
        ...fakeToken,
        expires_in: 0, // will compute expires_at ≈ Date.now() + 0 = already expired
      };

      const refreshedToken: AuthToken = {
        access_token: "refreshed-tok",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refreshed-ref",
        scope: 0,
      };

      // First call: credentialsFlow returns an already-expired token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(almostExpiredToken),
      });
      // Second call: refreshAuthToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshedToken),
      });

      const mod = await freshImport();
      // First getAccessToken triggers credentialsFlow, then detects near-expiry and refreshes
      const result = await mod.getAccessToken();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.access_token).toBe("refreshed-tok");
    });
  });
});
