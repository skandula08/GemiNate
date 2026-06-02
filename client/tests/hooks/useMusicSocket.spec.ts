import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMusicSocket } from "../../src/hooks/useMusicSocket.ts";
import type { Playlist } from "@gamenite/shared";

const mockEmit = vi.fn();
const mockOff = vi.fn();
const mockSocketHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockSocketHandlers[event] = handler;
  }),
  off: mockOff,
  emit: mockEmit,
};

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({
    user: { username: "testuser", display: "Test User", createdAt: new Date() },
    socket: mockSocket,
  }),
}));

vi.mock("../../src/services/musicService.ts", () => ({
  getPlaylistById: vi.fn(() =>
    Promise.resolve({
      playlistId: "playlist-1",
      tracks: [
        {
          trackId: 1,
          urn: "sc:1",
          title: "Track 1",
          artist: null,
          artwork: "",
          duration: 100,
          streamUrl: "",
        },
      ],
    }),
  ),
}));

// Stub fetch so the stream URL fetch doesn't crash
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: false })),
);

const fakeAuth = { kind: "password" as const, username: "testuser", password: "password" };

const fakePl: Playlist = {
  playlistId: "playlist-1",
  title: "Test",
  communityId: "c1",
  owner: { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
  djList: [],
  tracks: [
    {
      trackId: 1,
      urn: "sc:1",
      title: "Track 1",
      artist: null,
      artwork: "",
      duration: 100,
      streamUrl: "",
    },
  ],
  duration: 100,
};

describe("useMusicSocket – musicPlaylistUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  });

  it("calls setPlaylist when musicPlaylistUpdate is received", () => {
    const setPlaylist = vi.fn();
    renderHook(() => useMusicSocket("playlist-1", fakeAuth, setPlaylist));

    const updatedPlaylist: Playlist = { ...fakePl, title: "Updated Title" };

    act(() => {
      mockSocketHandlers["musicPlaylistUpdate"]({ playlist: updatedPlaylist });
    });

    expect(setPlaylist).toHaveBeenCalledExactlyOnceWith(updatedPlaylist);
  });

  it("registers listeners for joinedMusicStream and musicPlaylistUpdate on mount", () => {
    const setPlaylist = vi.fn();
    renderHook(() => useMusicSocket("playlist-1", fakeAuth, setPlaylist));

    expect(mockSocket.on).toHaveBeenCalledWith("joinedMusicStream", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("musicPlaylistUpdate", expect.any(Function));
  });

  it("removes all listeners on unmount", () => {
    const setPlaylist = vi.fn();
    const { unmount } = renderHook(() => useMusicSocket("playlist-1", fakeAuth, setPlaylist));
    unmount();

    expect(mockOff).toHaveBeenCalledWith("musicPlaybackUpdate", expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith("joinedMusicStream", expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith("musicPlaylistUpdate", expect.any(Function));
  });
});

describe("useMusicSocket – loopMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  });

  it("returns loopMode from the most recent musicPlaybackUpdate", () => {
    const setPlaylist = vi.fn();
    const { result } = renderHook(() => useMusicSocket("playlist-1", fakeAuth, setPlaylist));

    expect(result.current.loopMode).toBe("none");

    act(() => {
      mockSocketHandlers["musicPlaybackUpdate"]({
        state: {
          trackId: 1,
          startedAt: Date.now(),
          isPlaying: true,
          nextTrack: fakePl.tracks[0],
          loopMode: "all",
        },
      });
    });

    expect(result.current.loopMode).toBe("all");
  });

  it("defaults to 'none' when loopMode is absent from state", () => {
    const setPlaylist = vi.fn();
    const { result } = renderHook(() => useMusicSocket("playlist-1", fakeAuth, setPlaylist));

    act(() => {
      mockSocketHandlers["musicPlaybackUpdate"]({
        state: {
          trackId: 1,
          startedAt: Date.now(),
          isPlaying: true,
          nextTrack: fakePl.tracks[0],
        },
      });
    });

    expect(result.current.loopMode).toBe("none");
  });
});
