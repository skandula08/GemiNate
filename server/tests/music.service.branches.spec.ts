import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track, TrackInput } from "@gamenite/shared";

// Mock PlaylistRepo.get to return null so we hit the !playlist branches
vi.mock("../src/repository.ts", () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PlaylistRepo: {
    get: vi.fn(() => Promise.resolve(null)),
    find: vi.fn(() => Promise.resolve(null)),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    getMany: vi.fn(() => Promise.resolve([])),
    set: vi.fn(),
    add: vi.fn(() => Promise.resolve("mock-id")),
    clear: vi.fn(),
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  CommunityRepo: {
    get: vi.fn(() =>
      Promise.resolve({
        name: "TestComm",
        participants: [{ userId: "u1", role: "member" }], // no owner!
      }),
    ),
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PlaylistByCommunityIndex: {
    find: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(),
  },
}));

import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  moveTrackInPlaylist,
  syncPlaylistRolesFromCommunity,
} from "../src/services/music.service.ts";
import { PlaylistRepo, CommunityRepo, PlaylistByCommunityIndex } from "../src/repository.ts";

const sampleTrackInput: TrackInput = {
  trackId: 123,
  urn: "soundcloud:tracks:123",
  title: "Test",
  artist: "Artist",
  artwork: "http://art.jpg",
  duration: 180000,
  streamUrl: "http://stream",
};

const sampleTrack: Track = {
  trackId: 123,
  urn: "soundcloud:tracks:123",
  title: "Test",
  artist: "Artist",
  artwork: "http://art.jpg",
  duration: 180000,
  streamUrl: "http://stream",
};

describe("music.service – unreachable null-playlist branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("addTrackToPlaylist throws when PlaylistRepo.get returns null", async () => {
    await expect(addTrackToPlaylist("nonexistent", sampleTrackInput)).rejects.toThrow(
      "Playlist not found",
    );
  });

  it("removeTrackFromPlaylist throws when PlaylistRepo.get returns null", async () => {
    await expect(removeTrackFromPlaylist("nonexistent", sampleTrack)).rejects.toThrow(
      "Playlist not found",
    );
  });

  it("moveTrackInPlaylist throws when PlaylistRepo.get returns null", async () => {
    await expect(moveTrackInPlaylist("nonexistent", 123, 0)).rejects.toThrow("Playlist not found");
  });
});

describe("music.service – syncPlaylistRolesFromCommunity with no owner", () => {
  it("handles community with no owner participant", async () => {
    // Setup: a playlist exists for community c1
    // getMany returns the same objects as the repo stores - this is what syncPlaylistRolesFromCommunity
    // uses as `playlist` (line 418). It must have an owner so we can verify it stays unchanged.
    const existingPlaylist = {
      communityId: "c1",
      owner: { userId: "u1", role: "owner" },
      djList: [{ userId: "u1", role: "member" }],
      tracks: [],
      title: "Test",
      duration: 0,
    };
    (PlaylistByCommunityIndex.find as ReturnType<typeof vi.fn>).mockResolvedValue("p1");
    (PlaylistRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue(existingPlaylist);
    (CommunityRepo.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "TestComm",
      participants: [{ userId: "u1", role: "member" }], // no owner!
    });
    (PlaylistRepo.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // syncPlaylistRolesFromCommunity will:
    // 1. Find the playlist for community c1 via getMany
    // 2. Look for an owner in community.participants -> not found (newOwner undefined)
    // 3. Skip updating playlist.owner (the !newOwner branch at line 421)
    // 4. Try to call populatePlaylistInfo which calls populateSafeUserInfo
    // populateSafeUserInfo will fail because UserRepo is not mocked, so we expect an error
    try {
      await syncPlaylistRolesFromCommunity("c1");
    } catch {
      // Expected - populatePlaylistInfo will fail with mocked repos
      // The important thing is that the !newOwner branch at line 421 was exercised
    }

    // Verify PlaylistRepo.set was called (meaning we got past the !newOwner branch)
    expect(PlaylistRepo.set).toHaveBeenCalled();

    // Verify the saved playlist still has the original owner unchanged
    const setCall = (PlaylistRepo.set as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(setCall[1].owner).toStrictEqual({ userId: "u1", role: "owner" });
  });
});
